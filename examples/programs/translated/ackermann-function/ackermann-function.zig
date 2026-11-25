// Ackermann function in Zig, defined recursively

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn ackermann(first: i64, second: i64) i64 {
    if (first == 0) {
        return second + 1;
    }
    if (second == 0) {
        return ackermann(first - 1, 1);
    }
    return ackermann(first - 1, ackermann(first, second - 1));
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var first: i64 = 0;
    while (first <= 3) : (first += 1) {
        var second: i64 = 0;
        while (second <= 4) : (second += 1) {
            out.print("ackermann({d}, {d}) = {d}\n", .{ first, second, ackermann(first, second) }) catch {};
        }
    }
}
