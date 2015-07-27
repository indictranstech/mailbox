# -*- coding: utf-8 -*-
# Copyright (c) 2015, New Indictrans Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from email.utils import formataddr, parseaddr
from frappe.utils import get_url, get_formatted_email, cstr, cint
from frappe.utils.file_manager import get_file
import frappe.email.smtp
from frappe import _
from frappe.desk.form.load import get_attachments
import mailbox

class Mailbox(Document):
	def on_update(self):
		self.attach_mail_to_customer_or_supplier()

	def attach_mail_to_customer_or_supplier(self):
		"""
			If mail tagged by Customer or supplier attach that mail to respective
			supplier and  customer
			Check these contact exsits for which customer or supplier get that supplier or customer 
			and attach mail in his comment section
		"""
		if self.customer and not cint(self.get("tagged")):
			if not frappe.db.get_value('Contact',{"customer":self.customer,"email_id":self.sender},"name"):
				self.create_contact(contact_for="Customer")
			
			self.append_mail_to_doc("Customer",self.customer)
			self.tagged = 1

		elif self.supplier and not cint(self.get("tagged")):
			if not frappe.db.get_value('Contact',{"supplier":self.supplier,"email_id":self.sender},"name"):
				self.create_contact(contact_for="supplier")

			self.append_mail_to_doc("Supplier",self.supplier)
			self.tagged = 1


	def create_contact(self,contact_for):
		"""Create contact of sender against supplier/customer"""
		contact = frappe.get_doc({
			"doctype":"Contact",
			"first_name": self.sender_full_name,
			"email_id": self.sender,
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
				self.append_mail_to_doc("Customer",cobj.customer,"Received")
				self.customer = cobj.customer
				self.tagged = 1

			elif cobj.supplier:
				self.append_mail_to_doc("Supplier",cobj.supplier,"Received")
				self.supplier = cobj.supplier
				self.tagged = 1

	def append_mail_to_doc(self,doctype,docname,action):
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
			"sent_or_received": action,
			"reference_doctype":doctype,
			"reference_name": docname
		})
		comm.insert(ignore_permissions=True)

@frappe.whitelist()
def make(doctype=None, name=None, content=None, subject=None, sent_or_received = "Sent",
	sender=None, recipients=None, communication_medium="Email", send_email=False,
	print_html=None, print_format=None, attachments='[]', ignore_doctype_permissions=False,
	send_me_a_copy=False,email_account=None,doc=None,forward_or_reply=None):


	if not sender and frappe.session.user != "Administrator":
		sender = frappe.db.get_value("Email Config",{"name":email_account},"email_id")
	import json	
	doc = json.loads(doc)
	
	comm = frappe.get_doc({
		"doctype":"Mailbox",
		"subject": subject,
		"content": content,
		"tag": doc.get('tag') or "",
		"customer": doc.get("customer") or "",
		"supplier": doc.get("supplier") or "",
		"sender": sender,
		"recipients": recipients,
	})
	comm.insert(ignore_permissions=True)

	#attachments = get_attachments(doctype,name)
	attachments = prepare_attachments(attachments)
	for attachment in attachments:
		file_data = {}
		furl = "/files/%s"%attachment["fname"] 
		file_data.update({
			"doctype": "File Data",
			"attached_to_doctype":"Outbox",
			"attached_to_name":comm.name,
			"file_url":furl,
			"file_name":attachment["fname"]
			
		})
		f = frappe.get_doc(file_data)
		f.flags.ignore_permissions = True
		f.insert();

	recipients = get_recipients(recipients)
	attachments = prepare_attachments(attachments)
	
	mailbox.sendmail(
		recipients=recipients,
		sender=sender,
		subject=subject,
		content=content,
		attachments=attachments,
	)

	doc = frappe.get_doc("Inbox",name)
	if forward_or_reply == 'reply':
		doc.tag = 'Responded'
	elif forward_or_reply == 'forward':
		doc.tag = 'Forwarded to Other User'	
	doc.save(ignore_permissions=True)

	return {
		"name": comm.name,
		"recipients": ", ".join(recipients) if recipients else None

	}

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
	for email_account in frappe.get_list("Email Config", filters={"enabled": 1,"user":frappe.session.user}):
		email_config = frappe.get_doc('Email Config',email_account)
		email_config.receive()

@frappe.whitelist()
def check_contact(contact=None):
	if contact:
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