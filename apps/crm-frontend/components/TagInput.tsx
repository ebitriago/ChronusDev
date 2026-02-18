'use client';

import { useState, useEffect, useRef } from 'react';
import { API_URL, Tag } from '../app/api';

interface TagInputProps {
    selectedTags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}

export default function TagInput({ selectedTags, onChange, placeholder = "Agregar etiqueta..." }: TagInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<Tag[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTags();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const fetchTags = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tags`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllTags(data);
            }
        } catch (error) {
            console.error("Error fetching tags", error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        if (val.trim()) {
            const filtered = allTags.filter(tag =>
                tag.name.toLowerCase().includes(val.toLowerCase()) &&
                !selectedTags.includes(tag.name)
            );
            setSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
            removeTag(selectedTags[selectedTags.length - 1]);
        }
    };

    const addTag = (name: string) => {
        const trimmed = name.trim();
        if (trimmed && !selectedTags.includes(trimmed)) {
            onChange([...selectedTags, trimmed]);
            setInputValue('');
            setShowSuggestions(false);
        }
    };

    const removeTag = (name: string) => {
        onChange(selectedTags.filter(t => t !== name));
    };

    // Helper to get color if tag exists
    const getTagColor = (name: string) => {
        const tag = allTags.find(t => t.name === name);
        return tag?.color || '#6B7280';
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all min-h-[42px]">
                {selectedTags.map(tag => (
                    <span
                        key={tag}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-white"
                        style={{ backgroundColor: getTagColor(tag) }}
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-red-200 ml-1"
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedTags.length === 0 ? placeholder : ""}
                    className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
                />
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map(tag => (
                        <button
                            key={tag.id}
                            type="button"
                            onClick={() => addTag(tag.name)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                        </button>
                    ))}
                </div>
            )}

            {showSuggestions && inputValue && suggestions.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg p-2">
                    <button
                        type="button"
                        onClick={() => addTag(inputValue)}
                        className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 text-blue-600 font-medium"
                    >
                        Crear nueva etiqueta "{inputValue}"
                    </button>
                </div>
            )}
        </div>
    );
}
