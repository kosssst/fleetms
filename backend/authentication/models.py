from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.
class User(AbstractUser):
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30, null=True, blank=True)
    password = models.CharField(max_length=256)
    role = models.CharField(max_length=50, null=True, blank=True)
    company_id = models.IntegerField(null=True)

    def __str__(self):
        return self.username