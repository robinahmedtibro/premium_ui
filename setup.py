from setuptools import setup, find_packages

setup(
    name="premium_ui",
    version="0.1.0",
    description="A modern, premium SaaS-style interface for Frappe Framework and ERPNext v15",
    author="Codenexora",
    author_email="info@codenexora.xyz",
    packages=find_packages(include=["premium_ui", "premium_ui.*"]),
    zip_safe=False,
    include_package_data=True,
    install_requires=[],
)
