# authentication/forms.py
from django import forms
from django.core.validators import RegexValidator


class UserSignupForm(forms.Form):
    username = forms.CharField(
        max_length=150,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9]+$',
                message="Username must be alphanumeric"
            )
        ]
    )
    password = forms.CharField(widget=forms.PasswordInput)
    email = forms.EmailField()
    first_name = forms.CharField(max_length=30)
    last_name = forms.CharField(max_length=30)