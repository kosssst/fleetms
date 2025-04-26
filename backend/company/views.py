import json

from django.db import IntegrityError
from django.http import JsonResponse
from rest_framework.decorators import api_view

from company.forms import CompanyCreationForm
from company.models import Company


@api_view(['POST', 'OPTIONS'])
def create_company(request):
    data = json.loads(request.body)
    form = CompanyCreationForm(data)

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

    return JsonResponse({'message': 'Company created successfully'}, status=201)