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