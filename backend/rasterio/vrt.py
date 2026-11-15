from contextlib import contextmanager
from . import MockDataset

@contextmanager
def WarpedVRT(src, *args, **kwargs):
    yield src
