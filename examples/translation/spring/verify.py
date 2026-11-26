"""Check the translated method's calls and metadata with small framework doubles."""

from pathlib import Path
from typing import get_type_hints


class UserDto:
    pass


class CreateUserRequest:
    pass


class HttpStatus:
    CREATED = 201


class ResponseEntity:
    @classmethod
    def __class_getitem__(cls, item):
        return cls

    @staticmethod
    def status(status):
        class Builder:
            def body(self, user):
                return status, user

        return Builder()


class UserService:
    def createUser(self, request):
        assert isinstance(request, CreateUserRequest)
        return UserDto()


def PostMapping(function):
    return function


RequestBody = object()
Valid = object()
userService = UserService()
scope = dict(globals())
path = Path(__file__).with_name("create-user.py")
exec(compile(path.read_text(), str(path), "exec"), scope)
method = scope["create_user"]
status, user = method(CreateUserRequest())
assert status == 201
assert isinstance(user, UserDto)
hints = get_type_hints(method, globalns=scope, include_extras=True)
assert hints["request"].__metadata__ == (RequestBody, Valid)
assert hints["return"] is ResponseEntity
print("Spring method call order, response, named types, and parameter metadata verified")
