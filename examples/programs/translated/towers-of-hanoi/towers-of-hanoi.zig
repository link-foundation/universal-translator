// Towers of Hanoi in Zig, solved recursively

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn moveDisks(count: i64, source: i64, target: i64, spare: i64) void {
    if (count == 0) {
        return;
    }
    moveDisks(count - 1, source, spare, target);
    out.print("Move disk {d} from {d} to {d}\n", .{ count, source, target }) catch {};
    moveDisks(count - 1, spare, target, source);
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    moveDisks(4, 1, 3, 2);
}
