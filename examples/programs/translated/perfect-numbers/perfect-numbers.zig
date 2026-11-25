// Perfect numbers in Zig: numbers equal to the sum of their divisors

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn isPerfect(number: i64) bool {
    var sum: i64 = 1;
    var divisor: i64 = 2;
    while (divisor * divisor <= number) {
        if (@rem(number, divisor) == 0) {
            sum += divisor;
            if (divisor * divisor != number) {
                sum += @divTrunc(number, divisor);
            }
        }
        divisor += 1;
    }
    return number > 1 and sum == number;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var number: i64 = 1;
    while (number <= 10000) : (number += 1) {
        if (isPerfect(number)) {
            out.print("{d}\n", .{number}) catch {};
        }
    }
}
