from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('choice/', views.choice, name='choice'),
    path('choice/evil', views.evil, name='evil'),
    path('choice/good', views.good, name='good'),
]