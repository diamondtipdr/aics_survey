/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Check, ChevronRight, Mail, Shield, 
  Zap, BarChart, ChevronLeft, Loader2, 
  Award, FileText, Lock 
} from 'lucide-react';
import './aics_lead_magnet.css';

export default function AICSScorecard() {
  // State Management
  const [step, setStep] = useState(0); // 0: Landing, 1: Demographics, 2-17: Questions, 18: Email, 19: Result
  const [demographics, setDemographics] = useState({ name: '', industry: '', dept_size: '', country: '' });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    mode?: string;
    totalScore?: number;
    maxScore?: number;
    teaser?: string;
    message?: string;
    success?: boolean;
    pillars?: { pillarId: number; label: string; score: number; maxScore: number }[];
  } | null>(null);
  const [error, setError] = useState('');

  const industries = [
    "Financiero / Banca", "Retail / Consumo", "Manufactura", 
    "Tecnología / Telecomunicaciones", "Sector Público", 
    "Salud / Farmacéutica", "Energía / Recursos", "Servicios", "Otro"
  ];

  const deptSizes = [
    { id: "1-3", label: "1 a 3 auditores" },
    { id: "4-10", label: "4 a 10 auditores" },
    { id: "11-50", label: "11 a 50 auditores" },
    { id: "+50", label: "Más de 50 auditores" }
  ];

  const countries = [
    "Argentina", "Bolivia", "Chile", "Colombia", "Costa Rica",
    "Cuba", "Ecuador", "El Salvador", "España", "Estados Unidos",
    "Guatemala", "Honduras", "México", "Nicaragua", "Panamá",
    "Paraguay", "Perú", "Puerto Rico", "República Dominicana",
    "Uruguay", "Venezuela", "Otro"
  ];

  const questions = [
    // PILAR 1: Integración Metodológica
    {
      pillar: "Integración Metodológica",
      text: "Respecto a las metodologías de riesgo (COSO, ISO), su departamento:",
      options: [
        { value: 1, label: "No las utiliza formalmente o solo las menciona en el manual." },
        { value: 2, label: "Auditoría las usa, pero la 1ra y 2da línea tienen las suyas propias (Silos)." },
        { value: 3, label: "Hay un esfuerzo por unificarlas, pero el mapeo sigue siendo manual." },
        { value: 4, label: "Las 3 líneas utilizan una taxonomía de riesgo unificada y compartida." }
      ]
    },
    {
      pillar: "Integración Metodológica",
      text: "El Modelo de las Tres Líneas en su organización es:",
      options: [
        { value: 1, label: "Un concepto teórico sin aplicación práctica." },
        { value: 2, label: "Se entiende, pero operamos como 'policías' alejados del negocio." },
        { value: 3, label: "Actuamos como consejeros, pero los controles se solapan con la 2da línea." },
        { value: 4, label: "Está integrado; auditamos 'con' el negocio, no 'contra' el negocio." }
      ]
    },
    {
      pillar: "Integración Metodológica",
      text: "La actualización del Universo de Auditoría se realiza:",
      options: [
        { value: 1, label: "Anualmente, basado en el historial pasado." },
        { value: 2, label: "Anualmente, con algunas entrevistas a la gerencia." },
        { value: 3, label: "Semestralmente, ajustando según cambios mayores." },
        { value: 4, label: "De forma continua (trimestral/mensual) basada en indicadores de riesgo." }
      ]
    },
    {
      pillar: "Integración Metodológica",
      text: "Cuando emiten una recomendación, la gerencia (1ra línea):",
      options: [
        { value: 1, label: "Suele resistirse o ignorarla." },
        { value: 2, label: "La acepta pero tarda meses en implementarla (por considerarla burocracia)." },
        { value: 3, label: "La implementa, pero sin retroalimentación continua." },
        { value: 4, label: "La co-diseña con auditoría, integrándola en sus operaciones desde el inicio." }
      ]
    },
    // PILAR 2: Automatización y Análisis de Datos
    {
      pillar: "Automatización de Datos",
      text: "El cruce y validación de bases de datos para sus pruebas se hace:",
      options: [
        { value: 1, label: "Manualmente (muestreo en papel o vista simple en pantalla)." },
        { value: 2, label: "En Excel mediante filtros básicos y VLOOKUP/BUSCARV." },
        { value: 3, label: "Usando Power Query, macros o software especializado esporádicamente." },
        { value: 4, label: "De forma automatizada mediante scripts o flujos de trabajo (RPA) constantes." }
      ]
    },
    {
      pillar: "Automatización de Datos",
      text: "El muestreo en sus auditorías operativas abarca:",
      options: [
        { value: 1, label: "Menos del 5% de la población total (muestreo estadístico tradicional)." },
        { value: 2, label: "Entre el 10% y el 30% usando herramientas básicas." },
        { value: 3, label: "Revisamos el 100% de la población en procesos clave, pero con mucho esfuerzo." },
        { value: 4, label: "Evaluamos el 100% de los datos mediante rutinas automatizadas." }
      ]
    },
    {
      pillar: "Automatización de Datos",
      text: "El uso de Inteligencia Artificial (GenAI, Machine Learning) en su equipo es:",
      options: [
        { value: 1, label: "Nulo o prohibido." },
        { value: 2, label: "Experimental por algunos auditores, sin lineamientos (Riesgo en la sombra)." },
        { value: 3, label: "Usamos prompts básicos para resumir o redactar (con políticas definidas)." },
        { value: 4, label: "Integrado en procesos: análisis masivo, detección de anomalías o scripting." }
      ]
    },
    {
      pillar: "Automatización de Datos",
      text: "El seguimiento de los planes de acción (hallazgos) se administra en:",
      options: [
        { value: 1, label: "Correos electrónicos dispersos." },
        { value: 2, label: "Un documento de Excel compartido (susceptible a errores)." },
        { value: 3, label: "Un módulo básico dentro de un software de gestión documental." },
        { value: 4, label: "Un tablero dinámico y automatizado (Dashboard) visible para todas las líneas." }
      ]
    },
    // PILAR 3: Agilidad y Ejecución
    {
      pillar: "Agilidad y Ejecución",
      text: "El Plan Anual de Auditoría es tratado como:",
      options: [
        { value: 1, label: "Un documento rígido e inamovible, cueste lo que cueste." },
        { value: 2, label: "Mayormente fijo, con un 10% de espacio para emergencias." },
        { value: 3, label: "Flexible, pero requiere aprobaciones burocráticas lentas." },
        { value: 4, label: "Un Backlog priorizado que se ajusta y calibra constantemente (Agilidad)." }
      ]
    },
    {
      pillar: "Agilidad y Ejecución",
      text: "El tiempo promedio desde el fin del trabajo de campo hasta la emisión del informe es:",
      options: [
        { value: 1, label: "Más de 45 días." },
        { value: 2, label: "Entre 30 y 45 días." },
        { value: 3, label: "Entre 15 y 30 días." },
        { value: 4, label: "Menos de 15 días." }
      ]
    },
    {
      pillar: "Agilidad y Ejecución",
      text: "Durante la fase de ejecución, la comunicación con el cliente auditado ocurre:",
      options: [
        { value: 1, label: "Solo al inicio y en la reunión de cierre ('efecto sorpresa')." },
        { value: 2, label: "A través de solicitudes formales de requerimientos (memorandos)." },
        { value: 3, label: "Reuniones semanales de estado." },
        { value: 4, label: "Sincronizaciones diarias o bi-semanales muy breves (estilo Daily Standup)." }
      ]
    },
    {
      pillar: "Agilidad y Ejecución",
      text: "La estructura de los equipos de auditoría para cada encargo es:",
      options: [
        { value: 1, label: "Jerárquica y piramidal estricta (Junior -> Senior -> Gerente)." },
        { value: 2, label: "Equipos fijos por área (Ej: solo los de TI auditan TI)." },
        { value: 3, label: "Multidisciplinaria en ocasiones especiales." },
        { value: 4, label: "Squads multidisciplinarios auto-gestionados que asumen la responsabilidad." }
      ]
    },
    // PILAR 4: Impacto y Comunicación
    {
      pillar: "Impacto y Comunicación",
      text: "La extensión promedio de sus informes finales es:",
      options: [
        { value: 1, label: "Más de 30 páginas (mucha narrativa, historia y detalles menores)." },
        { value: 2, label: "Entre 15 y 30 páginas." },
        { value: 3, label: "Menos de 15 páginas, pero aún en formato de texto denso." },
        { value: 4, label: "Diapositivas ejecutivas o informes de 1 a 3 páginas altamente visuales." }
      ]
    },
    {
      pillar: "Impacto y Comunicación",
      text: "La estructura de sus hallazgos se centra en:",
      options: [
        { value: 1, label: "Describir minuciosamente el error del pasado ('quién tuvo la culpa')." },
        { value: 2, label: "Cumplir con los 5 atributos clásicos, pero con un tono punitivo." },
        { value: 3, label: "Destacar el riesgo futuro, aunque la recomendación sea genérica." },
        { value: 4, label: "Soluciones prácticas y automatizables, co-creadas con el negocio." }
      ]
    },
    {
      pillar: "Impacto y Comunicación",
      text: "El uso de visualización de datos (Dashboards) en sus informes es:",
      options: [
        { value: 1, label: "Inexistente; usamos tablas estáticas de Word." },
        { value: 2, label: "Insertamos gráficos básicos de pastel o barras de Excel." },
        { value: 3, label: "Usamos PowerBI/Tableau para anexos, pero el informe sigue siendo de texto." },
        { value: 4, label: "El reporte ES un dashboard interactivo enfocado en el apetito de riesgo." }
      ]
    },
    {
      pillar: "Impacto y Comunicación",
      text: "El Comité de Auditoría y la Alta Gerencia consideran su departamento como:",
      options: [
        { value: 1, label: "Un mal necesario para el cumplimiento normativo." },
        { value: 2, label: "Revisores útiles de las transacciones pasadas." },
        { value: 3, label: "Especialistas que ayudan a mantener los controles funcionando." },
        { value: 4, label: "Asesores estratégicos que anticipan riesgos de negocio." }
      ]
    }
  ];

  // Local score calculation (no API call)
  const PILLAR_MAP = [
    { pillarId: 1, questions: ['q1','q2','q3','q4'], label: 'Integración Metodológica' },
    { pillarId: 2, questions: ['q5','q6','q7','q8'], label: 'Automatización de Datos' },
    { pillarId: 3, questions: ['q9','q10','q11','q12'], label: 'Agilidad y Ejecución' },
    { pillarId: 4, questions: ['q13','q14','q15','q16'], label: 'Impacto y Comunicación' },
  ] as const;

  const calculateLocalScores = (currentAnswers: Record<string, number>) => {
    const pillars = PILLAR_MAP.map(p => ({
      pillarId: p.pillarId,
      label: p.label,
      score: p.questions.reduce((sum, q) => sum + (currentAnswers[q] || 0), 0),
      maxScore: 16,
    }));
    const totalScore = Object.values(currentAnswers).reduce((sum, v) => sum + v, 0);
    setResult({
      mode: 'local',
      totalScore,
      maxScore: 64,
      pillars,
    });
  };

  const handleAnswer = (questionIndex: number, value: number) => {
    const qKey = `q${questionIndex + 1}`;
    const newAnswers = { ...answers, [qKey]: value };
    setAnswers(newAnswers);

    if (questionIndex === 15) {
      // Last question — calculate scores locally and show results
      calculateLocalScores(newAnswers);
      setStep(18);
    } else {
      // Auto-advance after short delay for better UX
      setTimeout(() => {
        setStep(prev => prev + 1);
      }, 300);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const submitForm = async () => {
    setError('');
    if (!email.includes('@')) {
      setError('Por favor, ingresa un correo corporativo válido.');
      return;
    }

    setIsSubmitting(true);

    // Convert answers object { q1: 3, q2: 4, ... } to array [{ questionId: 1, value: 3 }, ...]
    const answersArray = Object.entries(answers).map(([key, value]) => ({
      questionId: parseInt(key.replace('q', ''), 10),
      value,
    }));

    const payload = {
      dept_size: demographics.dept_size,
      industry: demographics.industry,
      country: demographics.country,
      answers: answersArray,
      name: demographics.name.trim() || 'Auditor',
      email,
    };

    try {
      const API_URL = "/api/v1/scorecard/process";
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      setResult(prev => prev ? { ...prev, mode: 'full', message: data.message, success: true } : prev);
      setStep(19);

    } catch (err) {
      setError('Ocurrió un error al enviar tu solicitud. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step >= 2 && step <= 17 && !isSubmitting) {
        const keyMap: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, a: 1, b: 2, c: 3, d: 4 };
        const val = keyMap[e.key.toLowerCase()];
        if (val) {
          handleAnswer(step - 2, val);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, isSubmitting]);

  return (
    <div className="app-shell">
      {/* Inject Fonts */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap');
      `}} />

      {/* Header/Nav (Visible except on Landing) */}
      {step > 0 && (
        <header className="page-header">
          <img src="/logo.png" alt="AICS" className="logo-image" />
        </header>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-container">
          
          {/* STEP 0: LANDING */}
          {step === 0 && (
            <div className="hero-panel fade-in">
              <div className="hero-panel-content">
                <div className="hero-logo-wrapper">
                  <img src="/logo.png" alt="AICS" className="hero-logo-image" />
                </div>
                <h1 className="hero-panel-title">Índice de Madurez AICS</h1>
                <p className="hero-panel-copy">
                  Evalúa los 4 pilares de tu departamento en 8 minutos. Recibe un reporte confidencial analizado con Inteligencia Artificial y descubre tu ruta hacia el aseguramiento moderno.
                </p>

                <div className="hero-panel-banner">Qué recibirás</div>
                <div className="hero-panel-copy" style={{ marginBottom: '32px' }}>
                  Cada paso está separado y explicado para que se entienda inmediatamente cómo funciona el proceso y qué recibirás al completar la evaluación.
                </div>

                <div className="hero-feature-group">
                  <div className="hero-feature-card">
                    <div className="hero-feature-head">
                      <div className="hero-feature-icon" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                        <Zap size={24} />
                      </div>
                      <span className="hero-feature-badge">1</span>
                    </div>
                    <div>
                      <h4 className="hero-feature-heading">16 Preguntas</h4>
                      <p className="hero-feature-text">Diseñadas para identificar cuellos de botella en tu auditoría y priorizar mejoras.</p>
                    </div>
                  </div>

                  <div className="hero-feature-card">
                    <div className="hero-feature-head">
                      <div className="hero-feature-icon" style={{ background: 'linear-gradient(135deg,#f59e0b,#fb923c)' }}>
                        <BarChart size={24} />
                      </div>
                      <span className="hero-feature-badge">2</span>
                    </div>
                    <div>
                      <h4 className="hero-feature-heading">Análisis IA</h4>
                      <p className="hero-feature-text">Diagnóstico procesado por nuestro modelo experto para contextualizar tu madurez.</p>
                    </div>
                  </div>

                  <div className="hero-feature-card">
                    <div className="hero-feature-head">
                      <div className="hero-feature-icon" style={{ background: 'linear-gradient(135deg,#10b981,#14b8a6)' }}>
                        <FileText size={24} />
                      </div>
                      <span className="hero-feature-badge">3</span>
                    </div>
                    <div>
                      <h4 className="hero-feature-heading">Reporte PDF</h4>
                      <p className="hero-feature-text">Plan de acción con «Quick Wins» claro, entregado directamente a tu correo.</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  style={{
                    marginTop: '40px',
                    background: 'linear-gradient(135deg,#f59e0b,#fb923c)',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '1rem',
                    padding: '1rem 2rem',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 20px 60px rgba(251,146,60,0.28)',
                  }}
                >
                  Comenzar Evaluación <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: DEMOGRAPHICS */}
          {step === 1 && (
            <div className="page-card demographics-card fade-in">
              <h2 className="font-heading" style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '18px' }}>
                Antes de empezar...
              </h2>
              <p style={{ color: '#475569', marginBottom: '28px', lineHeight: 1.75, fontSize: '1rem' }}>
                Ayúdanos a personalizar tu diagnóstico para que los resultados de la IA sean precisos a tu contexto.
              </p>

              <div className="demographics-card">
                <div className="field-card indigo">
                  <label className="field-label">
                    Su nombre (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Pérez"
                    value={demographics.name}
                    onChange={(e) => setDemographics({...demographics, name: e.target.value})}
                    className="field-select"
                  />
                </div>

                <div className="field-card indigo">
                  <label className="field-label">
                    1. ¿A qué sector pertenece su empresa?
                  </label>
                  <select 
                    value={demographics.industry}
                    onChange={(e) => setDemographics({...demographics, industry: e.target.value})}
                    className="field-select"
                  >
                    <option value="" disabled>Seleccione una industria...</option>
                    {industries.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div className="field-card amber">
                  <label className="field-label">
                    2. ¿Cuál es el tamaño de su departamento de auditoría?
                  </label>
                  <div className="options-grid">
                    {deptSizes.map(size => (
                      <button
                        key={size.id}
                        onClick={() => setDemographics({...demographics, dept_size: size.id})}
                        className={`option-card ${demographics.dept_size === size.id ? 'selected' : ''}`}
                        type="button"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span>{size.label}</span>
                          {demographics.dept_size === size.id && <Check size={20} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-card indigo">
                  <label className="field-label">
                    País
                  </label>
                  <select
                    value={demographics.country}
                    onChange={(e) => setDemographics({...demographics, country: e.target.value})}
                    className="field-select"
                  >
                    <option value="" disabled>Seleccione un país...</option>
                    {countries.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="question-footer" style={{ borderTop: '1px solid rgba(226, 232, 240, 0.8)' }}>
                  <button onClick={handleBack} className="secondary-link" type="button">
                    <ChevronLeft size={18} /> Volver
                  </button>
                  <button 
                    onClick={() => setStep(2)}
                    disabled={!demographics.industry || !demographics.dept_size}
                    className="primary-button"
                    type="button"
                  >
                    Siguiente Pregunta <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEPS 2-17: THE 16 QUESTIONS */}
          {step >= 2 && step <= 17 && (
            <div key={step} className="page-card fade-in question-step">
              <div className="question-title">
                <span>Pregunta {step - 1} de 16</span>
                <h2 className="question-heading font-heading">{questions[step-2].text}</h2>
              </div>

              <div className="question-options">
                {questions[step-2].options.map((opt, index) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  const isSelected = answers[`q${step-1}`] === opt.value;

                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(step - 2, opt.value)}
                      className={`question-option-card ${isSelected ? 'selected' : ''}`}
                      type="button"
                    >
                      <span className="question-option-badge">{letters[index]}</span>
                      <div className="question-option-text">
                        {opt.label}
                      </div>
                      {isSelected && (
                        <Check size={20} style={{ color: '#4f46e5' }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="question-footer">
                <button onClick={handleBack} className="secondary-link" type="button">
                  <ChevronLeft size={20} /> Anterior
                </button>
                <div className="question-key-hint">
                  <span>Presiona</span>
                  <kbd className="question-kbd">A</kbd>
                  <span>-</span>
                  <kbd className="question-kbd">D</kbd>
                </div>
              </div>
            </div>
          )}

          {/* STEP 18: DIAGNÓSTICO COMPLETADO (shows score immediately) */}
          {step === 18 && result && (
            <div className="page-card result-panel fade-in">
              <div className="result-badge">
                <span>{result.totalScore}</span>
              </div>
              <h2 className="font-heading" style={{ marginBottom: '20px', textAlign: 'center' }}>
                ¡Diagnóstico Completado!
              </h2>
              <p style={{ color: '#475569', lineHeight: 1.8, fontSize: '1rem', marginBottom: '24px', textAlign: 'center', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                Puntuación general: <strong style={{ color: '#0f172a' }}>{result.totalScore} / 64</strong>
              </p>

              {/* Pillar breakdown */}
              <div className="results-grid" style={{ marginBottom: '32px' }}>
                {result?.pillars?.map(p => (
                  <div key={p.pillarId} className="result-pillar-card">
                    <div className="result-pillar-header">
                      <span>{p.label}</span>
                      <span className="result-pillar-score">{p.score} / {p.maxScore}</span>
                    </div>
                    <div className="result-pillar-bar-track">
                      <div
                        className="result-pillar-bar-fill"
                        style={{ width: `${(p.score / p.maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Email section */}
              <div style={{
                maxWidth: '520px',
                margin: '0 auto',
                display: 'grid',
                gap: '18px',
                textAlign: 'center',
              }}>
                <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7 }}>
                  ¿Quieres recibir el reporte detallado con análisis de IA y recomendaciones en PDF?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setStep(17)}
                    className="secondary-link"
                    type="button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ChevronLeft size={18} /> Volver a pregunta 16
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Mail size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="email-input"
                  />
                </div>

                {error && <p style={{ color: '#f87171', fontSize: '0.95rem', fontWeight: 600 }}>{error}</p>}

                <button
                  onClick={() => submitForm()}
                  disabled={isSubmitting}
                  className="primary-button"
                  type="button"
                  style={{ width: '100%' }}
                >
                  {isSubmitting ? (
                    <><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> Enviando reporte...</>
                  ) : (
                    <><Mail size={20} /> Enviar reporte detallado a mi correo</>
                  )}
                </button>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href="https://www.auditoriainteligente.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary-link"
                    style={{ textDecoration: 'none' }}
                  >
                    Ir a Auditoría Inteligente
                  </a>
                  <a
                    href="https://auditan.do"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary-link"
                    style={{ textDecoration: 'none' }}
                  >
                    Conocer más sobre la Academia Auditoría Inteligente
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* STEP 19: RESULTS ONLY (no email) */}
          {step === 19 && result && (
            <div className="page-card result-panel fade-in">
              <div className="result-badge">
                <span>{result.totalScore}</span>
              </div>
              <h2 className="font-heading" style={{ marginBottom: '20px', textAlign: 'center' }}>
                Puntuación: {result.totalScore} / 64
              </h2>

              <div style={{ textAlign: 'center', color: '#475569', marginBottom: '28px' }}>
                <p style={{ lineHeight: 1.8 }}>
                  Gracias por participar en esta auto-evaluación, estará recibiendo en su correo electrónico un PDF describiendo la composición del puntuaje de madurez.
                </p>
              </div>

              {/* Pillar breakdown */}
              <div className="results-grid" style={{ marginBottom: '32px' }}>
                {result?.pillars?.map(p => (
                  <div key={p.pillarId} className="result-pillar-card">
                    <div className="result-pillar-header">
                      <span>{p.label}</span>
                      <span className="result-pillar-score">{p.score} / {p.maxScore}</span>
                    </div>
                    <div className="result-pillar-bar-track">
                      <div
                        className="result-pillar-bar-fill"
                        style={{ width: `${(p.score / p.maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href="https://www.auditoriainteligente.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-button"
                    style={{ textDecoration: 'none', display: 'inline-flex' }}
                  >
                    Ir a Auditoría Inteligente
                  </a>
                  <a
                    href="https://auditan.do"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-button"
                    style={{ textDecoration: 'none', display: 'inline-flex' }}
                  >
                    Conocer más sobre la Academia Auditoría Inteligente
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
