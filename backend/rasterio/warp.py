from enum import Enum

class Resampling(Enum):
    nearest = 0
    bilinear = 1
    cubic = 2
    average = 5

def transform(src_crs, dst_crs, xs, ys):
    return xs, ys

def transform_bounds(src_crs, dst_crs, left, bottom, right, top, **kwargs):
    return left, bottom, right, top

def reproject(source, destination, src_transform=None, src_crs=None, dst_transform=None, dst_crs=None, resampling=Resampling.nearest, **kwargs):
    destination[:] = source[:destination.shape[0], :destination.shape[1], :destination.shape[2]] if hasattr(source, 'shape') else 0
    return destination, dst_transform

def transform_geom(src_crs, dst_crs, geom):
    return geom
