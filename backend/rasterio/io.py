from contextlib import contextmanager
from . import MockDataset
from PIL import Image
import io, numpy as np

class MemoryFile:
    def __init__(self, data=b""):
        self.data = data

    @contextmanager
    def open(self, *args, **kwargs):
        try:
            im = Image.open(io.BytesIO(self.data))
            arr = np.array(im)
            if len(arr.shape) == 2:
                arr = arr[np.newaxis, ...]
            yield MockDataset(arr=arr)
        except Exception:
            yield MockDataset()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass
