from django.shortcuts import render

# Create your views here.
def home(request):
    return render(request, 'page/home.html', {})

def choice(request):
    return render(request, 'page/choice.html', {})

def evil(request):
    return render(request, 'page/evil.html', {})

def good(request):
    return render(request, 'page/good.html', {})