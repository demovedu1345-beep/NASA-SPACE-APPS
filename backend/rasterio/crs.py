class CRS:
    @classmethod
    def from_epsg(cls, code):
        return f"EPSG:{code}"
    @classmethod
    def from_string(cls, string):
        return string
