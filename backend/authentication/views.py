import json

from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth import login as auth_login
from rest_framework.decorators import api_view

from .models import User
from .forms import UserSignupForm, UserLoginForm


@csrf_exempt
@api_view(['POST', 'OPTIONS'])
def signup(request):
    data = json.loads(request.body)
    form = UserSignupForm(data)

    if not form.is_valid():
        return JsonResponse({'error': 'Invalid data', 'details': form.errors}, status=400)

    username = form.cleaned_data['username']
    password = form.cleaned_data['password']
    email = form.cleaned_data['email']
    first_name = form.cleaned_data['first_name']
    last_name = form.cleaned_data['last_name']

    hashed_password = make_password(password)
    user = User(
        username=username,
        password=hashed_password,
        email=email,
        first_name=first_name,
        last_name=last_name
    )
    try:
        user.save()
    except IntegrityError:
        return JsonResponse({'error': 'User already exists'}, status=400)

    return JsonResponse({'message': 'User created successfully'}, status=201)

@csrf_exempt
@api_view(['POST', 'OPTIONS'])
def login(request):
    data = json.loads(request.body)
    form = UserLoginForm(data)

    if not form.is_valid():
        return JsonResponse({'error': 'Invalid data', 'details': form.errors}, status=400)

    username = form.cleaned_data['username']
    email = form.cleaned_data['email']
    password = form.cleaned_data['password']

    if not (username or email):
        return JsonResponse({'error': 'Username/Email and password are required'}, status=400)

    try:
        # More explicit user lookup
        if username:
            user = User.objects.get(username=username)
        elif email:
            user = User.objects.get(email=email)
        else:
            return JsonResponse({'error': 'Username or email required'}, status=400)
    except User.DoesNotExist:
        return JsonResponse({'error': 'Invalid credentials'}, status=400)

    if not check_password(password, user.password):
        return JsonResponse({'error': 'Invalid credentials'}, status=400)

    auth_login(request, user)

    return_data = {
        'user_id': user.user_id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'company_id': user.company.id if user.company else None,
    }

    return JsonResponse(return_data, status=200)

def check_auth(request):
    if request.user.is_authenticated:
        return JsonResponse({'message': 'Authenticated'}, status=200)
    else:
        return JsonResponse({'error': 'Not authenticated'}, status=401)