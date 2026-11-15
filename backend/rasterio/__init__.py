"""Rasterio fallback compatibility shim."""
from contextlib import contextmanager
import numpy as np

__version__ = "1.4.0-shim"

@contextmanager
def Env(**kwargs):
    yield

class MockDataset:
    def __init__(self, arr=None, crs="EPSG:4326", transform=None):
        self.arr = arr if arr is not None else np.zeros((1, 64, 64), dtype="float32")
        self.count = self.arr.shape[0] if len(self.arr.shape) > 2 else 1
        self.height = self.arr.shape[-2]
        self.width = self.arr.shape[-1]
        self.crs = crs
        self.transform = transform
        self.bounds = (75.5, 12.0, 76.0, 12.5)

    def read(self, indexes=1, masked=False, window=None, out_shape=None):
        if isinstance(indexes, int):
            sl = self.arr[indexes - 1] if indexes <= len(self.arr) else self.arr[0]
            if masked:
                return np.ma.masked_invalid(sl)
            return sl
        return self.arr

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

@contextmanager
def open(fp, *args, **kwargs):
    yield MockDataset()
