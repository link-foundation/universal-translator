int choose(int _ut_payload0) {
    int _ut_raised0 = 4;
    try {
        if (_ut_payload0 == 0) {
            return _ut_raised0;
        }
        try {
            if (_ut_payload0 == 1) {
                throw 6;
            }
            throw 8;
        } catch (double ignored) {
            return 92;
        } catch (int caught) {
            if (caught == 6) {
                caught = 9;
                throw;
            }
            throw
                10;
        }
    } catch (long ignored) {
        return 93;
    } catch (int value) {
        return value + _ut_raised0;
    }
    return 94;
}

int to_outer_handler() {
    try {
        try {
            throw 7;
        } catch (double ignored) {
            return 95;
        }
    } catch (...) {
        return 14;
    }
    return 96;
}

int main() {
    if (choose(0) != 4) {
        return 97;
    }
    if (choose(1) != 10) {
        return 98;
    }
    if (choose(2) != 14) {
        return 99;
    }
    if (to_outer_handler() != 14) {
        return 100;
    }
    return 42;
}
