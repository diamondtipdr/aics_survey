/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Check, ChevronRight, Mail, Shield, 
  Zap, Target, BarChart, ChevronLeft, Loader2, 
  Award, FileText, Lock 
} from 'lucide-react';

export default function AICSScorecard() {
  // State Management
  const [step, setStep] = useState(0); // 0: Landing, 1: Demographics, 2-17: Questions, 18: Email, 19: Result
  const [demographics, setDemographics] = useState({ industry: '', dept_size: '' });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    mode?: string;
    total_score?: number;
    message?: string;
    success?: boolean;
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

  const handleAnswer = (questionIndex: number, value: number) => {
    const qKey = `q${questionIndex + 1}`;
    setAnswers(prev => ({ ...prev, [qKey]: value }));
    
    // Auto-advance after short delay for better UX
    setTimeout(() => {
      setStep(prev => prev + 1);
    }, 300);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const submitForm = async (isSkipping = false) => {
    setError('');
    setIsSubmitting(true);
    
    // Validate email if not skipping
    if (!isSkipping && !email.includes('@')) {
      setError('Por favor, ingresa un correo corporativo válido.');
      setIsSubmitting(false);
      return;
    }

    // STRICT JSON PAYLOAD AS REQUIRED BY BACKEND `Joi` SCHEMA
    const payload: {
      dept_size: string;
      industry: string;
      answers: Record<string, number>;
      email?: string;
    } = {
      dept_size: demographics.dept_size,
      industry: demographics.industry,
      answers: answers
    };
    
    if (!isSkipping) {
      payload.email = email;
    }

    try {
      const API_URL = "/api/v1/scorecard/process";
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      setResult(data);
      setStep(19);

    } catch (err) {
      setError('Ocurrió un error al procesar tu solicitud. Intenta nuevamente.');
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col selection:bg-teal-200">
      {/* Inject Fonts */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-heading { font-family: 'Montserrat', sans-serif; }
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />

      {/* Header/Nav (Visible except on Landing) */}
      {step > 0 && step < 19 && (
        <header className="w-full bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-600" />
            <span className="font-heading font-bold text-slate-900 tracking-tight">Auditoría<span className="text-teal-600">Inteligente</span></span>
          </div>
          {step >= 2 && step <= 17 && (
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
              <span className="hidden sm:inline">Pilar: {questions[step-2].pillar}</span>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teal-500 transition-all duration-500 ease-out" 
                  style={{ width: `${((step - 1) / 16) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right">{step - 1} / 16</span>
            </div>
          )}
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8">
        <div className="w-full max-w-3xl w-full mx-auto">
          
          {/* STEP 0: LANDING */}
          {step === 0 && (
            <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl text-center fade-in border border-slate-800">
              <div className="w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-teal-500/20">
                <Target className="w-10 h-10 text-teal-400" />
              </div>
              <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
                Índice de Madurez AICS
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
                Evalúa los 4 pilares de tu departamento en 8 minutos. Recibe un reporte confidencial analizado con Inteligencia Artificial y descubre tu ruta hacia el aseguramiento moderno.
              </p>
              
              <div className="grid sm:grid-cols-3 gap-6 mb-12 text-left">
                <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
                  <Zap className="w-6 h-6 text-teal-400 mb-3" />
                  <h3 className="font-heading font-semibold text-white mb-1">16 Preguntas</h3>
                  <p className="text-sm text-slate-400">Diseñadas para identificar cuellos de botella.</p>
                </div>
                <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
                  <BarChart className="w-6 h-6 text-teal-400 mb-3" />
                  <h3 className="font-heading font-semibold text-white mb-1">Análisis IA</h3>
                  <p className="text-sm text-slate-400">Diagnóstico procesado por nuestro modelo experto.</p>
                </div>
                <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
                  <FileText className="w-6 h-6 text-teal-400 mb-3" />
                  <h3 className="font-heading font-semibold text-white mb-1">Reporte PDF</h3>
                  <p className="text-sm text-slate-400">Plan de acción con "Quick Wins" a tu correo.</p>
                </div>
              </div>

              <button 
                onClick={() => setStep(1)}
                className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-heading font-bold text-lg px-8 py-4 rounded-full transition-all hover:scale-105 hover:shadow-lg hover:shadow-teal-500/25"
              >
                Comenzar Evaluación <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* STEP 1: DEMOGRAPHICS */}
          {step === 1 && (
            <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-100 fade-in">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                Antes de empezar...
              </h2>
              <p className="text-slate-500 mb-8">
                Ayúdanos a personalizar tu diagnóstico para que los resultados de la IA sean precisos a tu contexto.
              </p>

              <div className="space-y-8">
                <div>
                  <label className="block font-heading font-semibold text-slate-700 mb-3">
                    1. ¿A qué sector pertenece su empresa?
                  </label>
                  <select 
                    value={demographics.industry}
                    onChange={(e) => setDemographics({...demographics, industry: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-lg rounded-xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 block p-4 outline-none transition-all cursor-pointer"
                  >
                    <option value="" disabled>Seleccione una industria...</option>
                    {industries.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-heading font-semibold text-slate-700 mb-3">
                    2. ¿Cuál es el tamaño de su departamento de auditoría?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {deptSizes.map(size => (
                      <button
                        key={size.id}
                        onClick={() => setDemographics({...demographics, dept_size: size.id})}
                        className={`p-4 rounded-xl border-2 text-left font-medium transition-all ${
                            demographics.dept_size === size.id 
                              ? 'border-teal-500 bg-teal-50 text-teal-900' 
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex justify-between items-center">
                          {size.label}
                          {demographics.dept_size === size.id && <Check className="w-5 h-5 text-teal-600" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex justify-between items-center border-t border-slate-100">
                  <button onClick={handleBack} className="text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" /> Volver
                  </button>
                  <button 
                    onClick={() => setStep(2)}
                    disabled={!demographics.industry || !demographics.dept_size}
                    className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-heading font-bold px-8 py-4 rounded-xl transition-all flex items-center gap-2"
                  >
                    Siguiente Pregunta <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEPS 2-17: THE 16 QUESTIONS */}
          {step >= 2 && step <= 17 && (
            <div key={step} className="fade-in">
              <div className="mb-8">
                <span className="text-teal-600 font-bold tracking-wider text-sm uppercase">
                  Pregunta {step - 1} de 16
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-bold text-slate-900 mt-2 leading-tight">
                  {questions[step-2].text}
                </h2>
              </div>

              <div className="space-y-3">
                {questions[step-2].options.map((opt, index) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  const isSelected = answers[`q${step-1}`] === opt.value;
                  
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(step - 2, opt.value)}
                      className={`w-full text-left p-5 sm:p-6 rounded-2xl border-2 transition-all flex items-start gap-4 group ${
                          isSelected 
                            ? 'border-teal-500 bg-teal-50 shadow-md' 
                            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'
                        }`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-heading font-bold text-sm transition-colors ${
                        isSelected 
                          ? 'bg-teal-500 text-white' 
                          : 'bg-slate-100 text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-700'
                      }`}> 
                        {letters[index]}
                      </div>
                      <div className="flex-1">
                        <span className={`text-lg leading-snug ${isSelected ? 'text-teal-900 font-medium' : 'text-slate-700'}`}>
                          {opt.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-between items-center px-2">
                <button onClick={handleBack} className="text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1 transition-colors">
                  <ChevronLeft className="w-5 h-5" /> Anterior
                </button>
                <div className="text-sm text-slate-400 flex items-center gap-2">
                  <span className="hidden sm:inline">Presiona</span> 
                  <kbd className="px-2 py-1 bg-slate-200 rounded text-xs font-mono text-slate-600">A</kbd> - <kbd className="px-2 py-1 bg-slate-200 rounded text-xs font-mono text-slate-600">D</kbd>
                </div>
              </div>
            </div>
          )}

          {/* STEP 18: EMAIL GATED CAPTURE */}
          {step === 18 && (
            <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl text-center fade-in border border-slate-800">
              <div className="w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Award className="w-10 h-10 text-teal-400" />
              </div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-4">
                ¡Diagnóstico Completado!
              </h2>
              <p className="text-slate-300 mb-8 max-w-lg mx-auto text-lg">
                Ingresa tu correo corporativo para recibir de inmediato el reporte confidencial en PDF con el análisis de Inteligencia Artificial y tu plan de acción.
              </p>

              <div className="max-w-md mx-auto space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="email" 
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-lg rounded-xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 block pl-12 p-4 outline-none transition-all"
                  />
                </div>
                
                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

                <button 
                  onClick={() => submitForm(false)}
                  disabled={isSubmitting}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-heading font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg shadow-teal-500/20 flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-6 h-6 animate-spin" /> Procesando IA...</>
                  ) : (
                    <><Lock className="w-5 h-5" /> Ver mis resultados</>
                  )}
                </button>
                
                <button 
                  onClick={() => submitForm(true)}
                  disabled={isSubmitting}
                  className="w-full text-slate-400 hover:text-white font-medium text-sm py-2 transition-colors underline underline-offset-4"
                >
                  Omitir y ver solo mi puntaje general
                </button>
              </div>
              <p className="text-slate-500 text-xs mt-8">
                Tus respuestas son confidenciales, no entrenan modelos públicos y aceptas recibir tu diagnóstico vía correo.
              </p>
            </div>
          )}

          {/* STEP 19: RESULT / THANK YOU */}
          {step === 19 && result && (
            <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-100 text-center fade-in">
              {result.mode === 'preview' ? (
                // VIEW: NO EMAIL PROVIDED
                <>
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="font-heading font-black text-4xl text-slate-800">{result.total_score}</span>
                  </div>
                  <h2 className="font-heading text-2xl font-bold text-slate-900 mb-4">
                    Puntuación: {result.total_score} / 64
                  </h2>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 text-blue-900">
                    <p className="font-medium text-lg mb-2">{result.message}</p>
                    <p className="text-sm opacity-80">El reporte incluye el desglose de los 4 pilares y recomendaciones accionables creadas por IA.</p>
                  </div>
                  <button 
                    onClick={() => setStep(18)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-heading font-bold px-8 py-3 rounded-full transition-colors"
                  >
                    Volver para ingresar mi correo
                  </button>
                </>
              ) : (
                // VIEW: EMAIL PROVIDED (SUCCESS)
                <>
                  <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-12 h-12 text-teal-600" />
                  </div>
                  <h2 className="font-heading text-3xl font-bold text-slate-900 mb-4">
                    {result.message}
                  </h2>
                  <p className="text-slate-500 text-lg mb-8 max-w-md mx-auto">
                    Nuestra Inteligencia Artificial está estructurando tu reporte PDF con la metodología AICS. Llegará a <strong className="text-slate-800">{email}</strong> en los próximos minutos.
                  </p>
                  <div className="border-t border-slate-100 pt-8 mt-4">
                    <p className="font-heading font-semibold text-slate-800 mb-4">
                      ¿Listo para dar el siguiente paso hoy?
                    </p>
                    <a 
                      href="https://auditan.do/cursos/fundamentos" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex justify-center w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-heading font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
                    >
                      Ver Fundamentos de Auditoría Inteligente
                    </a>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
