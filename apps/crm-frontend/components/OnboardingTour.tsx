'use client';

import { useState, useEffect } from 'react';

type TourStep = {
    id: string;
    target: string;  // CSS selector or element ID
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
};

const TOUR_STEPS: TourStep[] = [
    {
        id: 'welcome',
        target: 'body',
        title: '¡Bienvenido a ChronusCRM! 🎉',
        content: 'Este tour te guiará por las principales funciones del sistema. ¡Empecemos!',
        position: 'bottom'
    },
    {
        id: 'sidebar',
        target: '[data-tour="sidebar"]',
        title: 'Menú Principal 📋',
        content: 'Aquí encuentras todas las secciones: Dashboard, Inbox, Clientes, Leads, y más.',
        position: 'right'
    },
    {
        id: 'inbox',
        target: '[data-tour="inbox"]',
        title: 'Inbox Unificado 💬',
        content: 'Gestiona conversaciones de WhatsApp, Instagram y chat en un solo lugar. La IA puede ayudarte con sugerencias de respuesta.',
        position: 'right'
    },
    {
        id: 'ai-button',
        target: '[data-tour="ai-suggestions"]',
        title: 'Sugerencias IA ✨',
        content: 'Haz clic aquí para obtener 3 respuestas sugeridas basadas en el contexto de la conversación.',
        position: 'top'
    },
    {
        id: 'leads',
        target: '[data-tour="leads"]',
        title: 'Pipeline de Leads 🎯',
        content: 'Arrastra leads entre columnas para cambiar su estado. Cada lead tiene un score automático que indica su potencial.',
        position: 'right'
    },
    {
        id: 'predictions',
        target: '[data-tour="predictions"]',
        title: 'Predicciones IA 📈',
        content: 'El dashboard muestra predicciones de MRR, riesgo de churn y análisis del pipeline de ventas.',
        position: 'bottom'
    },
    {
        id: 'channels',
        target: '[data-tour="channels"]',
        title: 'Canales Híbridos 📱',
        content: 'Configura cada canal como IA, Humano o Híbrido. Puedes tomar control manual cuando lo necesites.',
        position: 'right'
    }
];

interface OnboardingTourProps {
    onComplete: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    const step = TOUR_STEPS[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === TOUR_STEPS.length - 1;
    const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

    const handleNext = () => {
        if (isLast) {
            handleComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirst) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem('crm_onboarding_complete', 'true');
        onComplete();
    };

    const handleSkip = () => {
        handleComplete();
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Tour Modal */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
                    {/* Progress Bar */}
                    <div className="h-1 bg-gray-100">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Step indicator */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs text-gray-400 font-medium">
                                Paso {currentStep + 1} de {TOUR_STEPS.length}
                            </span>
                            <button
                                onClick={handleSkip}
                                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                Saltar tour
                            </button>
                        </div>

                        {/* Icon */}
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">
                                {step.id === 'welcome' && '👋'}
                                {step.id === 'sidebar' && '📋'}
                                {step.id === 'inbox' && '💬'}
                                {step.id === 'ai-button' && '✨'}
                                {step.id === 'leads' && '🎯'}
                                {step.id === 'predictions' && '📈'}
                                {step.id === 'channels' && '📱'}
                            </span>
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                            {step.title}
                        </h2>

                        {/* Description */}
                        <p className="text-gray-600 text-center text-sm leading-relaxed mb-6">
                            {step.content}
                        </p>

                        {/* Navigation */}
                        <div className="flex gap-3">
                            {!isFirst && (
                                <button
                                    onClick={handlePrev}
                                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                >
                                    ← Anterior
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                            >
                                {isLast ? '¡Empezar! 🚀' : 'Siguiente →'}
                            </button>
                        </div>
                    </div>

                    {/* Step Dots */}
                    <div className="flex justify-center gap-2 pb-6">
                        {TOUR_STEPS.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentStep(i)}
                                className={`w-2 h-2 rounded-full transition-all ${i === currentStep
                                        ? 'bg-emerald-500 w-6'
                                        : i < currentStep
                                            ? 'bg-emerald-300'
                                            : 'bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Tooltip component for inline help
interface TooltipProps {
    children: React.ReactNode;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, position = 'top' }: TooltipProps) {
    const [show, setShow] = useState(false);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && (
                <div className={`absolute ${positionClasses[position]} z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-xl animate-fadeIn`}>
                    {content}
                    {/* Arrow */}
                    <div className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
                            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' :
                                position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
                                    'right-full top-1/2 -translate-y-1/2 -mr-1'
                        }`} />
                </div>
            )}
        </div>
    );
}

// Help Button component - shows contextual tips
interface HelpButtonProps {
    tip: string;
}

export function HelpButton({ tip }: HelpButtonProps) {
    return (
        <Tooltip content={tip} position="top">
            <button className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs flex items-center justify-center transition-colors">
                ?
            </button>
        </Tooltip>
    );
}
