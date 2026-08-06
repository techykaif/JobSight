'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    const timer = setTimeout(fetchResults, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (result: any) => {
    router.push(result.url);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={() => setIsOpen(false)} role="dialog" aria-modal="true" aria-label="Global Search">
      <div className="global-search-modal" onClick={e => e.stopPropagation()}>
        <div className="global-search-header">
          <input
            ref={searchInputRef}
            type="text"
            className="global-search-input"
            placeholder="Search Jobs, Companies, Hunts, Technologies... (Cmd+K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleModalKeyDown}
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={results.length > 0}
          />
          {loading && <span className="global-search-spinner" aria-label="Loading" />}
        </div>
        
        {results.length > 0 && (
          <div className="global-search-results" id="search-results" role="listbox">
            {results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                className={`global-search-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(result)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <div className="global-search-item-type">{result.type}</div>
                <div className="global-search-item-content">
                  <div className="global-search-item-title">{result.title}</div>
                  <div className="global-search-item-subtitle">{result.subtitle}</div>
                </div>
                <div className="global-search-item-action">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="global-search-empty">
            No results found for "{query}"
          </div>
        )}
        
        <div className="global-search-footer">
          <div className="global-search-shortcut">
            <span>↑↓</span> to navigate
          </div>
          <div className="global-search-shortcut">
            <span>↵</span> to select
          </div>
          <div className="global-search-shortcut">
            <span>esc</span> to close
          </div>
        </div>
      </div>
    </div>
  );
}
