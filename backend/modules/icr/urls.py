from django.urls import path
from .views import (
    # Catálogo
    ContratosListView, ContratoDetailView,
    BolsasListView, BolsaDetailView,
    ReglasListView, ReglaDetailView,
    PorcentajesListView, PorcentajeDetailView,
    # Ciclo de vida
    ImportarInscripcionesView,
    PreinscribirView,
    FormalizarView,
    AnularView,
    # Consulta
    InscripcionesListView,
    InscripcionDetailView,
    StatsView,
    AuditoriaView,
)

urlpatterns = [
    # ── Catálogo CRUD ──────────────────────────────────────────────────────────
    path('contratos/',             ContratosListView.as_view()),
    path('contratos/<int:pk>/',    ContratoDetailView.as_view()),
    path('bolsas/',                BolsasListView.as_view()),
    path('bolsas/<int:pk>/',       BolsaDetailView.as_view()),
    path('reglas/',                ReglasListView.as_view()),
    path('reglas/<int:pk>/',       ReglaDetailView.as_view()),
    path('porcentajes/',           PorcentajesListView.as_view()),
    path('porcentajes/<int:pk>/',  PorcentajeDetailView.as_view()),

    # ── Acciones del ciclo de vida ─────────────────────────────────────────────
    path('importar/',              ImportarInscripcionesView.as_view()),
    path('preinscribir/',          PreinscribirView.as_view()),
    path('formalizar/',            FormalizarView.as_view()),
    path('anular/',                AnularView.as_view()),

    # ── Consulta ───────────────────────────────────────────────────────────────
    path('inscripciones/',         InscripcionesListView.as_view()),
    path('inscripciones/<int:pk>/', InscripcionDetailView.as_view()),
    path('stats/',                 StatsView.as_view()),
    path('auditoria/',             AuditoriaView.as_view()),
]
