# authentication/forms.py
from django import forms
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator

def validate_letters_only(value):
    if not all(char.isalpha() or char.isspace() for char in value):
        raise ValidationError("This field must contain only letters and spaces.")

class UserSignupForm(forms.Form):
    username = forms.CharField(
        max_length=50,
        min_length=3,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9]+$',
                message="Username must be alphanumeric"
            )
        ]
    )
    password = forms.CharField(
        widget=forms.PasswordInput,
        min_length=8
    )
    email = forms.EmailField()
    first_name = forms.CharField(
        max_length=50,
        validators=[
            validate_letters_only
        ]
    )
    last_name = forms.CharField(
        max_length=50,
        validators=[
            validate_letters_only
        ],
        required=False
    )

class UserLoginForm(forms.Form):
    username = forms.CharField(
        max_length=50,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9]+$',
                message="Username must be alphanumeric"
            )
        ],
        required=False
    )
    email = forms.EmailField(
        required=False
    )
    password = forms.CharField(
        widget=forms.PasswordInput,
        min_length=8
    )