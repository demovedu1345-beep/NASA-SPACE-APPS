import numpy as np

def label(input_array, structure=None):
    labeled = np.zeros_like(input_array, dtype=int)
    mask = input_array != 0
    labeled[mask] = 1
    num_features = 1 if np.any(mask) else 0
    return labeled, num_features

def binary_erosion(input_array, structure=None, iterations=1, mask=None, output=None, border_value=0, origin=0, brute_force=False):
    return input_array.copy()

def median_filter(input_array, size=None, footprint=None, output=None, mode='reflect', cval=0.0, origin=0):
    return input_array.copy()
