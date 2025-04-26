from django.urls import path

from .views import create_company

urlpatterns = [
    path("create", create_company, name="create"),
]