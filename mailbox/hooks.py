# -*- coding: utf-8 -*-
from __future__ import unicode_literals

app_name = "mailbox"
app_title = "Mailbox"
app_publisher = "New Indictrans Technologies Pvt. Ltd."
app_description = "Email Account Integration with pop3"
app_icon = "octicon octicon-mail-read"
app_color = "#5ac8fb"
app_email = "contact@indictranstech.com"
app_version = "0.0.1"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
#app_include_css = "mailbox/mailbox/doctype/mailbox/attachment_close.css"
# app_include_js = "/assets/mailbox/js/mailbox.js"

# include js, css files in header of web template
# web_include_css = "/assets/mailbox/css/mailbox.css"
# web_include_js = "/assets/mailbox/js/mailbox.js"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "mailbox.install.before_install"
# after_install = "mailbox.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

notification_config = "mailbox.startup.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events
fixtures = ["Tag"]

doc_events = {


	"Contact": {
		"on_update": ["mailbox.mailbox.doctype.email_contacts.email_contacts.validate_emailid", "mailbox.mailbox.doctype.email_contacts.email_contacts.validate_assigning_customers"]
	},
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
#	}
 }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"mailbox.tasks.all"
# 	],
# 	"daily": [
# 		"mailbox.tasks.daily"
# 	],
# 	"hourly": [
# 		"mailbox.tasks.hourly"
# 	],
# 	"weekly": [
# 		"mailbox.tasks.weekly"
# 	]
# 	"monthly": [
# 		"mailbox.tasks.monthly"
# 	]
# }

# Testing
# -------

# before_tests = "mailbox.install.before_tests"

# Overriding Whitelisted Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "mailbox.event.get_events"
# }

scheduler_events = {
	"all": [
		"mailbox.mailbox.doctype.email_account_config.email_account_config.pull"
	]
}