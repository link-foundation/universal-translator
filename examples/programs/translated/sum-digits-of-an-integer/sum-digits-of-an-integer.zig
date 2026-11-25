// Sum digits of an integer in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn sumOfDigits(initial_number: i64) i64 {
    var number: i64 = initial_number;
    var total: i64 = 0;
    while (number > 0) {
        total += @rem(number, 10);
        number = @divTrunc(number, 10);
    }
    return total;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    out.print("The digits of 1234567890 sum to {d}\n", .{sumOfDigits(1234567890)}) catch {};
}
