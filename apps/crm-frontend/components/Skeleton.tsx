import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rect',
    width,
    height
}) => {
    const baseClass = 'skeleton';
    const variantClass = variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded' : 'rounded-xl';

    return (
        <div
            className={`${baseClass} ${variantClass} ${className}`}
            style={{
                width: width || '100%',
                height: height || (variant === 'text' ? '1em' : '100%')
            }}
        />
    );
};

export const CardSkeleton = () => (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
            <Skeleton variant="rect" width={48} height={48} />
            <Skeleton variant="rect" width={60} height={20} />
        </div>
        <Skeleton variant="text" width="70%" height={24} />
        <Skeleton variant="text" width="40%" height={16} />
        <div className="pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="text" width="40%" height={20} />
            </div>
        </div>
    </div>
);

export const StatsSkeleton = () => (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
            <Skeleton variant="circle" width={48} height={48} />
            <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="60%" height={24} />
            </div>
        </div>
    </div>
);
