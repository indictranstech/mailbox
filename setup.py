# -*- coding: utf-8 -*-
from setuptools import setup, find_packages
import os

version = '0.0.1'

setup(
    name='mailbox',
    version=version,
    description='Email Account Integration with pop3',
    author='New Indictrans Technologies Pvt. Ltd.',
    author_email='contact@indictranstech.com',
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=("frappe",),
)
