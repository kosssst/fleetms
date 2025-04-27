from django.urls import path
from . import views

urlpatterns = [
    path("create", views.create_company, name="create_company"),
    path("<int:company_id>", views.get_company_by_id, name="get_company_by_id"),
    path("", views.get_user_company, name="get_user_company"),

]