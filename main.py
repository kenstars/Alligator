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
        result,lastresult = "",""
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
            for each in tags:
                if 'title' in each.attrib:
                    print 'title : ',each.attrib['title']
                    if each.attrib['title'].lower().strip() == "result".lower():
                        text = each.find('subpod')
                        for all in text:
                            print "all : ",all.attrib
                            result = result + all.attrib['title'] + "<br>"
                        break
                    else:
                        text = each.find('subpod')
                        for all in text:
                            print "all : ",all.attrib
                            lastresult = all.attrib['title'] + "<br>"
                else:
                    print "attribute without title : ",each.attrib
            if not result:
                if lastresult:
                    result = lastresult
                else:
                    result = self.randomResponses()
            if "data not available" in result:
                result = self.randomResponses()
            if "wolfram" in result.lower() :
                if "stephen" not in result.lower():
                    resultlist = result.split()
                    for each,value in enumerate(resultlist):
                        print each,value
                        if 'wolfram' in resultlist[each].lower():
                            resultlist[each] = "Alligator"
                            result = " ".join(resultlist)
                else:
                    result = result.replace("Stephen Wolfram","Kannan Piedy")
            return json.dumps({'result':result,'sessionId':'ui_'+session})
        except Exception,e:
            print "Exception in Run : ",e
    
    def randomResponses(self):
        returnvalue = random.choice(["Oooh , You've got me. I'll ask my master about how to answer this one.","You got me with a good one, I daresay I don't know that yet.","Hmm , There are still a lot to learn I guess.. I cant answer that right now , but someday... Someday I definitely will."])
        return returnvalue

if __name__ == '__main__':
    obj = Alligator()
    obj.gm_worker.work()