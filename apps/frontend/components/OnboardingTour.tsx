'use client';

import { useState, useEffect } from 'react';

type TourStep = {
    id: string;
    target: string;
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
};

const TOUR_STEPS: TourStep[] = [
    {
        id: 'welcome',
        target: 'body',
        title: '¡Bienvenido a ChronusDev! ⏱️',
        content: 'Tu plataforma para la gestión de proyectos y seguimiento de tiempo.',
        position: 'bottom'
    },
    {
        id: 'sidebar',
        target: '[data-tour="sidebar"]',
        title: 'Navegación Principal 🧭',
        content: 'Accede a tus Proyectos, Tareas y Reportes desde aquí.',
        position: 'right'
    },
    {
        id: 'timer',
        target: '[data-tour="timer"]',
        title: 'Timer Global ⏱️',
        content: 'Inicia o detén el contador de tiempo desde cualquier lugar de la aplicación.',
        position: 'bottom'
    },
    {
        id: 'projects',
        target: '[data-tour="projects"]',
        title: 'Proyectos 📁',
        content: 'Gestiona tus proyectos, presupuestos y miembros del equipo.',
        position: 'right'
    },
    {
        id: 'kanban',
        target: '[data-tour="kanban"]',
        title: 'Tablero Kanban 📋',
        content: 'Organiza tus tareas visualmente por estado: Todo, In Progress, Done.',
        position: 'left'
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
        localStorage.setItem('chronusdev_onboarding_complete', 'true');
        onComplete();
    };

    const handleSkip = () => {
        handleComplete();
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
                    <div className="h-1 bg-gray-100">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs text-gray-400 font-medium">
                                Paso {currentStep + 1} de {TOUR_STEPS.length}
                            </span>
                            <button onClick={handleSkip} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                Saltar tour
                            </button>
                        </div>
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">
                                {step.id === 'welcome' && '👋'}
                                {step.id === 'sidebar' && '🧭'}
                                {step.id === 'timer' && '⏱️'}
                                {step.id === 'projects' && '📁'}
                                {step.id === 'kanban' && '📋'}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">{step.title}</h2>
                        <p className="text-gray-600 text-center text-sm leading-relaxed mb-6">{step.content}</p>
                        <div className="flex gap-3">
                            {!isFirst && (
                                <button onClick={handlePrev} className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                                    ← Anterior
                                </button>
                            )}
                            <button onClick={handleNext} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all">
                                {isLast ? '¡Empezar! 🚀' : 'Siguiente →'}
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-center gap-2 pb-6">
                        {TOUR_STEPS.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentStep(i)}
                                className={`w-2 h-2 rounded-full transition-all ${i === currentStep ? 'bg-blue-500 w-6' : i < currentStep ? 'bg-blue-300' : 'bg-gray-200'}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
