from django import forms
from django.core.validators import RegexValidator

from .models import Company

class CompanyCreationForm(forms.ModelForm):
    name = forms.CharField(
        max_length=100,
        error_messages={
            'required': 'This field is required.',
            'max_length': 'Name cannot exceed 100 characters.'
        },
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9 ]+$',
                message="Company name must be alphanumeric and can include spaces."
            )
        ]
    )
