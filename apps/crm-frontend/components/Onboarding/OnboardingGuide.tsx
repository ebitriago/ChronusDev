"use client";

import { useState, useEffect } from "react";

/**
 * Onboarding Guide
 * This component manages the state of the onboarding tour.
 * It does not render UI itself but provides state to parent or wraps entire app if used as context.
 * For simplicity in this iteration, we will use it to just render a global overlay or Manage steps.
 */

// Step definitions
export const ONBOARDING_STEPS = [
    { id: 'dashboard', title: 'Dashboard', content: 'Aquí verás un resumen de tu negocio.' },
    { id: 'inbox', title: 'Bandeja de Entrada', content: 'Centraliza tus mensajes de WhatsApp e Instagram.' },
    { id: 'settings', title: 'Configuración', content: 'Ajusta tus canales y preferencias aquí.' },
];

export function useOnboarding() {
    const [stepIndex, setStepIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem('crm_onboarding_complete');
        if (!completed) {
            setIsActive(true);
        }
    }, []);

    const nextStep = () => {
        if (stepIndex < ONBOARDING_STEPS.length - 1) {
            setStepIndex(stepIndex + 1);
        } else {
            completeOnboarding();
        }
    };

    const completeOnboarding = () => {
        setIsActive(false);
        localStorage.setItem('crm_onboarding_complete', 'true');
    };

    return {
        isActive,
        currentStep: ONBOARDING_STEPS[stepIndex],
        nextStep,
        completeOnboarding
    };
}
