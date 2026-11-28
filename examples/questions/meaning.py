import inspect


def meaning(value):
    """Return the value unchanged."""
    return value


print(meaning.__doc__)
type(meaning)
inspect.getsource(meaning)
