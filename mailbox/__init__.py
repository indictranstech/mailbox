from __future__ import unicode_literals
import frappe
from frappe.email.email_body import get_email
from frappe.email.smtp import SMTPServer
import smtplib
from frappe import _

def sendmail(recipients, sender='', msg='', subject='[No Subject]', attachments=None, content=None,
	reply_to=None, cc=(), message_id=None,bcc=()):
	
	"""send an html email as multipart with attachments and all"""
	mail = get_email(recipients, sender, content or msg, subject, attachments=attachments, reply_to=reply_to, cc=cc)
	if message_id:
		mail.set_message_id(message_id)
	send_mail(mail,sender)

def send_mail(mail,sender):
	if sender:
		mail_config = frappe.db.get_value("Email Config",{"email_id":sender},"name")
		server_details = frappe.get_doc("Email Config",mail_config)
		
		try:
			smtpserver = SMTPServer(login=server_details.email_id, password=server_details.password, 
				server=server_details.smtp_server, port=587, 
				use_ssl=1, append_to=None)	
			
			mail.sender = smtpserver.login
			
			smtpserver.sess.sendmail(mail.sender, mail.recipients + (mail.cc or []),
				mail.as_string())
		
		except smtplib.SMTPSenderRefused:
			frappe.msgprint(_("Invalid login or password"))
			raise
		except smtplib.SMTPRecipientsRefused:
			frappe.msgprint(_("Invalid recipient address"))
			raise
	
