import json

from django.db import IntegrityError
from django.http import JsonResponse
from rest_framework.decorators import api_view
from django.views.decorators.csrf import ensure_csrf_cookie

from company.forms import CompanyCreationForm
from company.models import Company


@api_view(['POST'])
def create_company(request):
    form = CompanyCreationForm(request.data)

    if not form.is_valid():
        return JsonResponse({'error': 'Invalid data', 'details': form.errors}, status=400)

    name = form.cleaned_data['name']

    company = Company(
        name=name,
    )

    try:
        company.save()
    except IntegrityError:
        return JsonResponse({'error': 'Company with this name already exists'}, status=400)

    user = request.user

    if user.role == 'company_owner' or user.company:
        return JsonResponse({'error': 'User is already linked to a company'}, status=400)

    if user.role == 'user':
        user.role = 'company_owner'
        user.company = company
        user.save()

    return_data = company.get_public_data()

    return JsonResponse(return_data, status=201)

@api_view(['GET'])
def get_company_by_id(request, company_id):
    try:
        company = Company.objects.get(id=company_id)
        return_data = company.get_public_data()
        return JsonResponse(return_data, status=200)
    except Company.DoesNotExist:
        return JsonResponse({'error': 'Company not found'}, status=404)

@api_view(['GET'])
@ensure_csrf_cookie
def get_user_company(request):
    user = request.user
    if user.company:
        return_data = user.company.get_public_data()
        return JsonResponse(return_data, status=200)
    else:
        return JsonResponse({'error': 'User is not linked to any company'}, status=404)