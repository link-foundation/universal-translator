@PostMapping
public ResponseEntity<UserDto> createUser(
        @RequestBody @Valid CreateUserRequest request) {

    UserDto user = userService.createUser(request);

    return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(user);
}
