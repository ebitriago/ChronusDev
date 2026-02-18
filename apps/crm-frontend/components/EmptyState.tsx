import React from 'react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryLabel?: string;
    onSecondaryAction?: () => void;
}

export default function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondaryAction,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            {/* Icon / Illustration */}
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                {icon || (
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                )}
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>

            {/* Description */}
            {description && (
                <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">{description}</p>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {actionLabel && onAction && (
                    <button
                        onClick={onAction}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                        {actionLabel}
                    </button>
                )}
                {secondaryLabel && onSecondaryAction && (
                    <button
                        onClick={onSecondaryAction}
                        className="px-6 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                    >
                        {secondaryLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
