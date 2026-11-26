from typing import Annotated

@PostMapping
def create_user(request: "Annotated[CreateUserRequest, RequestBody, Valid]") -> "ResponseEntity[UserDto]":
    user = userService.createUser(request)

    return ResponseEntity.status(HttpStatus.CREATED).body(user)
