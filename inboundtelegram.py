from telegram.ext import Updater
import logging
from telegram.ext import CommandHandler
from telegram.ext import MessageHandler, Filters
import gearman
import json
config = json.load(open('config.json','r'))
AUTH_TOKEN = config['Telegram']['key']

class first_bot:
    def __init__(self):
        self.updater = Updater(token = AUTH_TOKEN )
        self.dispatcher = self.updater.dispatcher
        self.gm_client = gearman.GearmanClient(  [  config['gearmanip']+':'+str(config['gearmanport']) ] )
        logging.basicConfig( format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',level = logging.INFO )

    def run(self, bot_value, update_value):
        global bot
        global update
        bot = bot_value
        update = update_value
        ChatMsg = update.message.text
        custInfo = {'FirstName':update.message['chat']['first_name'],"LastName":update.message['chat']['last_name']}
        queryobj = {"customer_info":custInfo,"query":ChatMsg,"uId":str(update.message.chat_id),"lang":'en',"channel":"telegram"}
        print queryobj
        completed_task = self.gm_client.submit_job(str(config["gearmanworker_apiai"]),json.dumps(queryobj))
        result = json.loads(completed_task.result)
        if completed_task.state == 'COMPLETE':
            bot_value.sendMessage(chat_id=update.message.chat_id,text=result['result'])        

if __name__ == '__main__':
        telebot = first_bot()
        echo_handler = MessageHandler([Filters.text],telebot.run)
        telebot.dispatcher.add_handler(echo_handler)
        telebot.updater.start_polling(poll_interval = 1.0)
        telebot.updater.idle()
