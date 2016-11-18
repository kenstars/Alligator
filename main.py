import json
import re
from pymongo import MongoClient
from gearman import GearmanWorker
import requests
import xml.etree.ElementTree as ET
import random

class Alligator(object):
    def __init__(self):
        config = json.load(open('config.json','r'))
        self.gm_worker = GearmanWorker([  config['gearmanip']+':'+str(config['gearmanport']) ])
        self.gm_worker.register_task(str(config["gearmanworker_apiai"]),self.run)
        self.wolframkey = config["wolfram_key"]
    def run(self,gearman_worker,gearman_job):
        result,lastresult = "",[]
        try:
            request = json.loads(gearman_job.data)
            session = request['uId']
            channel = request['channel']
            query = request['query']
            print "QUERY : ",query
            language = 'en'
            apirequest = "http://api.wolframalpha.com/v2/query?input="+query+"&appid="+self.wolframkey+"&format=image"
            value = requests.get(apirequest)
            tags = ET.fromstring(value._content)
            imagelistings = []
            for each in tags:
                if 'title' in each.attrib:
                    #print 'title : ',each.attrib['title']
                    if each.attrib['title'].lower().strip() == "result".lower():
                        text = each.find('subpod')
                        for all in text:
                            #print "all : ",all.attrib
                            if 'title' in all.attrib:
                                if channel == 'ui':
                                    result = result + all.attrib['title'] + "<br>"
                                else:
                                    result = result + all.attrib['title'] + "\n"
                                imagelistings.append(all.attrib['src'])
                        break
                    elif "input" not in each.attrib['title'].lower().strip():
                        text = each.find('subpod')
                        for all in text:
                            #print "all : ",all.attrib
                            if 'title' in all.attrib:
                                if all.attrib['title'].strip():
                                    print all.attrib
                                    lastresult.append((each.attrib['title'],all.attrib['title']))
                                if 'src' in all.attrib:
                                    print "title :",each.attrib['title']
                                    imagelistings.append(all.attrib['src'])
                else:
                    print "attribute without title : ",each.attrib
            imageflag = False
            print "RESULT : ",result
            if not result.strip():
                if channel == 'ui':
                    if lastresult:
                        print "in lastresult"
                        currenttitle = ""
                        for each,all in lastresult:
                            if each != currenttitle:
                                currenttitle = each
                                result = result + "<br><b><u> "+each+": </u></b>"
                            result = result + "<br> "+all
                    elif imagelistings:
                        imageflag = True
                        print "in imagelistings",imagelistings
                        for each in imagelistings:
                            result = result + '<img src = "'+each+'" /> <br>'
                    else:
                        result = self.randomResponses()
                else:
                    if lastresult:
                        print "in lastresult"
                        currenttitle = ""
                        for each,all in lastresult:
                            if each != currenttitle and each.lower().strip() != "response":
                                currenttitle = each
                                result = result + "\n"+each+": "
                            result = result + "\n \t "+all
                    else:
                        result = self.randomResponses()
            print "RESULT : ",result
            if "data not available" in result:
                result = self.randomResponses()
            if "wolfram" in result.lower() and not imageflag:
                if "stephen" not in result.lower():
                    resultlist = result.split()
                    for each,value in enumerate(resultlist):
                        print each,value
                        if 'wolfram' in resultlist[each].lower():
                            resultlist[each] = "Alligator"
                            result = " ".join(resultlist)
                else:
                    result = result.replace("Stephen Wolfram","Kannan Piedy")
            #result = '<img src = "http://localhost:7000/image/logo.png" />'
            return json.dumps({'result':result,'sessionId':channel+'_'+session})
        except Exception,e:
            print "Exception in Run : ",e
    
    def randomResponses(self):
        returnvalue = random.choice(["Oooh , You've got me. I'll ask my master about how to answer this one.","You got me with a good one, I daresay I don't know that yet.","Hmm , There are still a lot to learn I guess.. I cant answer that right now , but someday... Someday I definitely will."])
        return returnvalue

if __name__ == '__main__':
    obj = Alligator()
    obj.gm_worker.work()