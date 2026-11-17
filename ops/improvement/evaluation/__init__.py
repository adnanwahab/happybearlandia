"""Offline evidence normalization; no execution, persistence or transport."""
from .adapter import evaluate, submit_rework

__all__ = ['evaluate', 'submit_rework']
