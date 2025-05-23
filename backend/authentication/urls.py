from django.urls import path

from . import views

urlpatterns = [
    path("signup", views.signup, name="signup"),
    path("login", views.login, name="login"),
    path("check", views.check_auth, name="check_auth"),
]