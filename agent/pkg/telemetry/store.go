package telemetry

import (
	"sync"
	"time"

	"github.com/mike/sentinel-agent/pkg/laravel"
)

// Store creates a ring buffer or time-window store for metrics
type Store struct {
	entries []laravel.PerformanceEntry
	mu      sync.RWMutex
	limit   int
}

func NewStore(limit int) *Store {
	return &Store{
		entries: make([]laravel.PerformanceEntry, 0, limit),
		limit:   limit,
	}
}

func (s *Store) Add(entry laravel.PerformanceEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Ensure timestamp if missing
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().Format("2006-01-02 15:04:05")
	}

	// Simple append
	s.entries = append(s.entries, entry)

	// Ring buffer logic (keep last N)
	if len(s.entries) > s.limit {
		s.entries = s.entries[len(s.entries)-s.limit:]
	}
}

func (s *Store) GetAll() []laravel.PerformanceEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return copy
	msgs := make([]laravel.PerformanceEntry, len(s.entries))
	copy(msgs, s.entries)
	return msgs
}

func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = []laravel.PerformanceEntry{}
}
