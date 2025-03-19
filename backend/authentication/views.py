import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth import login as auth_login

from .models import User
from .forms import UserSignupForm

@csrf_exempt
def signup(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)

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
    user.save()

    return JsonResponse({'message': 'User created successfully'}, status=201)

@csrf_exempt
def login(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)

    data = json.loads(request.body)
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not (username or email) or not password:
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

    return JsonResponse({'message': 'Login successful'}, status=200)

def check_auth(request):
    if request.user.is_authenticated:
        return JsonResponse({'message': 'Authenticated'}, status=200)
    else:
        return JsonResponse({'error': 'Not authenticated'}, status=401)