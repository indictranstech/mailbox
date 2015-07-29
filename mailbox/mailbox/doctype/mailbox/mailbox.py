# -*- coding: utf-8 -*-
# Copyright (c) 2015, New Indictrans Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from email.utils import formataddr, parseaddr
from frappe.utils import get_site_path, get_hook_method, get_files_path, random_string, encode, cstr,validate_email_add,get_url, scrub_urls, strip, expand_relative_urls, cint

from frappe.utils.file_manager import get_file
import frappe.email.smtp
from frappe import _
from frappe.desk.form.load import get_attachments
from frappe.email.email_body import get_email
from frappe.email.smtp import SMTPServer
import smtplib
from frappe import _

class Mailbox(Document):
	def on_update(self):
		self.attach_mail_to_customer_or_supplier()
		
		if self.tag and self.communication:
			self.update_tag_info()

		if self.action == 'Trash' and self.communication:
			if frappe.db.get_value("Communication",self.communication):
				frappe.delete_doc("Communication",self.communication)  


	def update_tag_info(self):
		related_content = """From: %(sender)s <br> To: %(recipients)s <br> Subject: %(subject)s <br> tag: %(tag)s"""%{
				"sender":self.sender,
				"recipients":self.recipient,
				"subject":self.subject,
				"tag":self.tag
			}
		comm = frappe.get_doc("Communication",self.communication)
		comm.content = related_content
		comm.save()

		

	def attach_mail_to_customer_or_supplier(self):
		"""
			If mail tagged by Customer or supplier attach that mail to respective
			supplier and  customer
			Check these contact exsits for which customer or supplier get that supplier or customer 
			and attach mail in his comment section
		"""
		if self.customer and not cint(self.get("tagged")) and not self.action == 'Trash':
			email_id = self.sender
			if self.action == 'Forwarded' or self.action == 'Replied' or self.action == 'Outgoing':
				email_id = self.recipient

			if not frappe.db.get_value('Contact',{"customer":self.customer,"email_id":email_id},"name"):
				self.create_contact(email_id,contact_for="Customer")
			
			self.append_mail_to_doc("Customer",self.customer)
			self.tagged = 1

		elif self.supplier and not cint(self.get("tagged")) and not self.action == 'Trash':
			email_id = self.sender
			if self.action == 'Forwarded' or self.action == 'Replied' or self.action == 'Outgoing':
				email_id = self.recipient


			if not frappe.db.get_value('Contact',{"supplier":self.supplier,"email_id":email_id},"name"):
				self.create_contact(email_id,contact_for="supplier")

			self.append_mail_to_doc("Supplier",self.supplier)
			self.tagged = 1


	def create_contact(self,email_id,contact_for):
		"""Create contact of sender against supplier/customer"""
		contact = frappe.get_doc({
			"doctype":"Contact",
			"first_name": self.sender_full_name,
			"email_id": email_id,
		})

		if contact_for == 'Customer':
			contact.update({
				"customer":self.customer
			})

		if contact_for == 'Supplier':
			contact.update({
				"supplier":self.supplier
			})

		contact.insert(ignore_permissions=True)

	def check_contact_exists(self):
		"""Check contact exists against any customer/suppler. 
		if it does then appennd these mail to customer/supplier"""
		contact_name = frappe.db.get_value("Contact",{"email_id":self.sender},"name")
		if contact_name:
			cobj = frappe.get_doc('Contact',contact_name)
			
			if cobj.customer:
				self.append_mail_to_doc("Customer",cobj.customer)
				self.customer = cobj.customer
				self.tagged = 1

			elif cobj.supplier:
				self.append_mail_to_doc("Supplier",cobj.supplier)
				self.supplier = cobj.supplier
				self.tagged = 1

	def append_mail_to_doc(self,doctype,docname):
		"""Create communication doc so that these mail can be seen as comment in customer/supplier"""

		related_content = """From: %(sender)s <br> To: %(recipients)s <br> Subject: %(subject)s <br> tag: %(tag)s"""%{
				"sender":self.sender,
				"recipients":self.recipient,
				"subject":self.subject,
				"tag":self.tag
			}
		
		comm = frappe.get_doc({
			"doctype":"Communication",
			"subject": self.subject,
			"content_full": self.content,
			"content":related_content,
			"sender": self.sender,
			"communication_medium": "Email",
			"sent_or_received": "Received",
			"reference_doctype":doctype,
			"reference_name": docname
		})
		comm.insert(ignore_permissions=True)
		self.communication = comm.name

@frappe.whitelist()
def make(doctype=None, name=None, content=None, subject=None, sent_or_received = "Sent",
	sender=None, recipients=None, communication_medium="Email", send_email=False,
	attachments='[]',email_account=None,doc=None,action=None,cc=None,bcc=None,form_values=None,ref_no=None):
	"""
		called from composer
		These Method manages craeting new mailbox document for reply/Forwarded and compose
		calls respective Methods
	"""
	import json
	if doc:	
		doc = json.loads(doc)

	mailbox_doc = {
		"doctype":doctype,
		"name":name,
		"content":content,
		"subject":subject,
		"sender":sender,
		"recipients":recipients,
		"attachments":attachments,
		"email_account":email_account,
		"doc":doc,
		"action":action,
		"cc":cc,
		"bcc":bcc,
		"form_values":json.loads(form_values),
	}

	return_dic = {}	
	if not validated_email_addrs(mailbox_doc,return_dic):
		return return_dic

	# add frappe.session.user != "Administrator" to condition

	if action and action != 'compose': 
		mailbox_doc["sender"] = frappe.db.get_value("Email Account Config",
			{"name":email_account},"email_id")
		mailbox_doc["sender"]

	if mailbox_doc['action'] == 'compose':
		attachments = get_attachments(ref_no)
	else:
		attachments = prepare_attachments(attachments)

		
	mailbox = append_to_mailbox(mailbox_doc)
	added_attachments = add_attachments(attachments,mailbox.name,mailbox_doc["action"])
	recipients = send_mail(mailbox_doc,attachments)

	return {
		"name": mailbox.name,
		"recipients": ", ".join(recipients) if recipients else None

	}

def validated_email_addrs(mailbox_doc,return_dic):
	if not single_recipient(mailbox_doc) and not mailbox_doc["action"] == 'reply_all':
		return_dic.update({"not_valid":"Only One recipient Allowed in 'To'"})
		return False
	
	if not validate_email_add(mailbox_doc['recipients']):
		return_dic.update({"not_valid":"Not Valid Email Id in To"})
		return False

	if not contact_exists(mailbox_doc['recipients']) and not mailbox_doc["action"] == 'reply':
		return_dic.update({"not_valid":"Please Create Contact with '%s' "%mailbox_doc["recipients"]})
		return False

	if not validate_cc_and_bcc(mailbox_doc,return_dic):
		return False

	else:
		return True	

def contact_exists(email_id):
	if not frappe.db.get_value('Contact',{"email_id":email_id},"name"):
		return False
	return True

		
def validate_cc_and_bcc(mailbox_doc,return_dic):
	for recipients in [get_recipients(mailbox_doc['cc']),get_recipients(mailbox_doc['bcc'])]:
		for recipient in recipients:
			if recipient and not validate_email_add(recipient):
				return_dic.update({"not_valid":"'%s' not valid Email Address"%recipient})
				return False

	return True		

def single_recipient(mailbox_doc):
	recipients = len(mailbox_doc["recipients"].split(','))
	if recipients > 1:
		return False
	return True


def send_mail(mailbox_doc,attachments):
	if mailbox_doc["action"] == 'compose':
		attachments = [attachment["file_name"] for attachment in attachments]
		attachments = prepare_attachments(attachments)

	recipients = get_recipients(mailbox_doc["recipients"])
	cc = get_recipients(mailbox_doc["cc"])
	bcc = get_recipients(mailbox_doc["bcc"])

	sendmail(
		recipients=recipients,
		sender=mailbox_doc["sender"],
		subject=mailbox_doc["subject"],
		content=mailbox_doc["content"],
		attachments=attachments,
		cc=cc,
		bcc=bcc
	)

	return recipients


def append_to_mailbox(mailbox_doc):
	action_mapper = {"compose":"Outgoing","reply":"Replied","forward":"Forwarded"}
	import datetime
	current_time = datetime.datetime.strptime(str(datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')),'%Y-%m-%d %H:%M:%S')
	recipients_name = ''
	
	if not mailbox_doc["action"] == 'reply':
		recipients_name = mailbox_doc["doc"].get('sender_full_name') 
	else:
		recipients_name = frappe.db.get_value("Contact",{"email_id":mailbox_doc["recipients"]},"first_name")

	if frappe.db.get_value("Email Account Config",{"email_id":mailbox_doc["sender"]},"email_account_name"):
		sender_full_name = frappe.db.get_value("Email Account Config",{"email_id":mailbox_doc["sender"]},"email_account_name")
	
	mailbox = frappe.get_doc({
		"doctype":"Mailbox",
		"subject": mailbox_doc["subject"],
		"content": mailbox_doc["content"],
		"tag": mailbox_doc["form_values"].get('tag') or "",
		"customer": mailbox_doc["form_values"].get("customer") or "",
		"supplier": mailbox_doc["form_values"].get("supplier") or "",
		"sender": mailbox_doc["sender"],
		"sender_full_name":sender_full_name,
		"recipient": mailbox_doc["recipients"],
		"recipients_name":recipients_name,
		"date_time":current_time,
		"cc": mailbox_doc["cc"],
		"cc": mailbox_doc["bcc"],
		"action": action_mapper.get(mailbox_doc["action"]),
		"email_account": mailbox_doc["email_account"],
		"user": frappe.session.user
	})
	mailbox.insert(ignore_permissions=True)
	 
	return mailbox


def add_attachments(attachments,mailbox_doc,action):
	for attachment in attachments:
		file_data = {}
		furl = ''
		fname = ''
		if action == 'compose':
			furl = "/files/%s"%attachment["file_name"]
			fname = attachment["file_name"]
		else :
			furl = "/files/%s"%attachment["fname"]
			fname = attachment["fname"]

		file_data.update({
			"doctype": "File Data",
			"attached_to_doctype":"Mailbox",
			"attached_to_name":mailbox_doc,
			"file_url":furl,
			"file_name":fname
			
		})
		f = frappe.get_doc(file_data)
		f.flags.ignore_permissions = True
		f.insert();
	return True

@frappe.whitelist()
def get_attachments(ref_no):
	return frappe.get_all("Compose", fields=["file_name"],
		filters = {"ref_no": ref_no})

def get_recipients(recipients):
	original_recipients = [s.strip() for s in cstr(recipients).split(",")]
	recipients = original_recipients[:]
	filtered = []
	for e in list(set(recipients)):
		email_id = parseaddr(e)[1]
		if e not in filtered and email_id not in filtered:
				filtered.append(e)
	return filtered


def prepare_attachments(g_attachments=None):
	attachments = []
	if g_attachments:
		if isinstance(g_attachments, basestring):
			import json
			g_attachments = json.loads(g_attachments)
		for a in g_attachments:
			if isinstance(a, basestring):
				# is it a filename?
				try:
					file = get_file(a)
					attachments.append({"fname": file[0], "fcontent": file[1]})
				except IOError:
					frappe.throw(_("Unable to find attachment {0}").format(a))
			else:
				attachments.append(a)
	return attachments


@frappe.whitelist()
def get_tagging_details(supplier_or_customer,sender):
	supplier_or_customer = supplier_or_customer.lower()
	
	return frappe.db.sql("""select %s from `tabContact` 
		where email_id='%s' 
		and %s!='' limit 1"""%(supplier_or_customer,sender,supplier_or_customer))


@frappe.whitelist()
def sync_for_current_user():
	for email_account in frappe.get_list("Email Account Config", filters={"enabled": 1,"user":frappe.session.user}):
		email_config = frappe.get_doc('Email Account Config',email_account)
		email_config.receive()

@frappe.whitelist()
def check_contact(contact=None,action=None):
	if contact and action in ['Incoming','Forwarded']:
		if not frappe.db.get_value("Contact",{"email_id":contact},"name"):
			return "Create a new Vendor/Customer"

@frappe.whitelist()
def check_tagging_status():
	users = frappe.db.sql("""SELECT user,name FROM 
		`tabInbox` 
		WHERE creation > (NOW() - INTERVAL 5 DAY)
		and tag!='' """,as_dict=1)

	recipients = []
	for user in users:
		if user.get('user') != 'Administrator':
			recipients.append(user.get('user'))

	if recipients:
		frappe.sendmail(recipients=recipients,
					subject="Tagging Reminder",
					message="""Its over five days Incoming Message Not tagged""")


@frappe.whitelist()
def trash_items():
	"""trash selected items from listview"""
	import json

	il = json.loads(frappe.form_dict.get('items'))

	for d in il:
		mailbox = frappe.get_doc("Mailbox",d)
		mailbox.update({
			"previous_action":mailbox.action,
			"action":"Trash"
		})
		mailbox.save()

@frappe.whitelist()
def get_emails():
	return frappe.db.sql("""select email_id from `tabEmail Account Config`
		where user='%s'"""%frappe.session.user,as_list=1)


def sendmail(recipients, sender='', msg='', subject='[No Subject]', attachments=None, content=None,
	reply_to=None, cc=(), message_id=None,bcc=()):
	
	"""send an html email as multipart with attachments and all"""
	mail = get_email(recipients, sender, content or msg, subject, attachments=attachments, reply_to=reply_to, cc=cc)
	bcc = build_bcc(bcc)
	if message_id:
		mail.set_message_id(message_id)
	send_mail_smtp(mail,sender,bcc)

def send_mail_smtp(mail,sender,bcc):
	if sender:
		mail_config = frappe.db.get_value("Email Account Config",{"email_id":sender},"name")
		server_details = frappe.get_doc("Email Account Config",mail_config)
		
		try:
			smtpserver = SMTPServer(login=server_details.email_id, password=server_details.password, 
				server=server_details.smtp_server, port=587, 
				use_ssl=1, append_to=None)	
			
			mail.sender = smtpserver.login
			
			smtpserver.sess.sendmail(mail.sender, mail.recipients + (mail.cc or []) + (bcc or []) ,
				mail.as_string())
		
		except smtplib.SMTPSenderRefused:
			frappe.msgprint(_("Invalid login or password"))
			raise
		except smtplib.SMTPRecipientsRefused:
			frappe.msgprint(_("Invalid recipient address"))
			raise		

def build_bcc(bcc):
	if isinstance(bcc, basestring):
		bcc = bcc.replace(';', ',').replace('\n', '')
		bcc = bcc.split(',')

	# remove null
	bcc = filter(None, (strip(r) for r in bcc))
	return bcc

@frappe.whitelist()
def format_cc_bcc_arrds(doc=None):
	import json
	if doc:
		doc = json.loads(doc)
		cc_list = []
		[cc_list.append(cc.split("<")[1]) for cc in doc["cc"].split(',')]
		f = 0
		emailaddr = []
		for c in cc_list:
			cc_a = c[:-1]
			emailaddr.append(cc_a)
			f = 1
		ccs = (', ').join(emailaddr)
		return ccs	
			
		