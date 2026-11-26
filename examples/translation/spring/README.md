# Annotated Java method

`create-user.java` is the method reported in issue 16. Its Python translation preserves named types, method and parameter annotations, and the fluent response calls. Python parameter annotations use `typing.Annotated` metadata and quoted types so declarations can precede the corresponding classes.

Run `python3 examples/translation/spring/verify.py` to execute the translation against small framework doubles and verify its response and metadata. This checks the method's calls, not HTTP routing: running it as an HTTP endpoint requires compatible implementations of the framework decorators and services.
