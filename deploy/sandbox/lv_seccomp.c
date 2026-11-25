/*
 * LEARNVERSE C17 Runtime Kernel Hardening (.preinit_array)
 * Compiled once into /usr/local/lib/lv_seccomp.o inside learnverse-sandbox-c.
 * Runs BEFORE user main() or constructors to lock down RLIMIT_AS (96 MiB),
 * disable ptrace dumpability, and block fork/clone/execve/socket/escape syscalls
 * inside the Linux kernel via seccomp-bpf (stopping macro/dlopen/asm bypasses).
 */
#define _GNU_SOURCE
#include <errno.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdint.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/syscall.h>

#if defined(__x86_64__)
#  define LV_AUDIT_ARCH AUDIT_ARCH_X86_64
#elif defined(__aarch64__)
#  define LV_AUDIT_ARCH AUDIT_ARCH_AARCH64
#else
#  error "Unsupported architecture for lv_seccomp"
#endif

#ifdef SECCOMP_RET_KILL_PROCESS
#  define LV_KILL_ACTION SECCOMP_RET_KILL_PROCESS
#else
#  define LV_KILL_ACTION SECCOMP_RET_KILL
#endif

#define LV_DENY_SYSCALL(nr) \
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, (nr), 0, 1), \
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (EPERM & 0x0000ffffU))

static void lv_sandbox_preinit(void) {
    struct rlimit rl_as = { 96ULL * 1024ULL * 1024ULL, 96ULL * 1024ULL * 1024ULL };
    setrlimit(RLIMIT_AS, &rl_as);

    struct rlimit rl_core = { 0, 0 };
    setrlimit(RLIMIT_CORE, &rl_core);

    struct rlimit rl_fsize = { 4ULL * 1024ULL * 1024ULL, 4ULL * 1024ULL * 1024ULL };
    setrlimit(RLIMIT_FSIZE, &rl_fsize);

    prctl(PR_SET_DUMPABLE, 0, 0, 0, 0);
    prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0);

    static struct sock_filter filter[] = {
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, LV_AUDIT_ARCH, 1, 0),
        BPF_STMT(BPF_RET | BPF_K, LV_KILL_ACTION),
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
#ifdef __NR_fork
        LV_DENY_SYSCALL(__NR_fork),
#endif
#ifdef __NR_vfork
        LV_DENY_SYSCALL(__NR_vfork),
#endif
        LV_DENY_SYSCALL(__NR_clone),
#ifdef __NR_clone3
        LV_DENY_SYSCALL(__NR_clone3),
#endif
        LV_DENY_SYSCALL(__NR_execve),
#ifdef __NR_execveat
        LV_DENY_SYSCALL(__NR_execveat),
#endif
        LV_DENY_SYSCALL(__NR_socket),
        LV_DENY_SYSCALL(__NR_socketpair),
        LV_DENY_SYSCALL(__NR_connect),
        LV_DENY_SYSCALL(__NR_bind),
        LV_DENY_SYSCALL(__NR_listen),
#ifdef __NR_accept
        LV_DENY_SYSCALL(__NR_accept),
#endif
        LV_DENY_SYSCALL(__NR_accept4),
        LV_DENY_SYSCALL(__NR_sendto),
        LV_DENY_SYSCALL(__NR_recvfrom),
        LV_DENY_SYSCALL(__NR_sendmsg),
        LV_DENY_SYSCALL(__NR_recvmsg),
        LV_DENY_SYSCALL(__NR_ptrace),
        LV_DENY_SYSCALL(__NR_process_vm_readv),
        LV_DENY_SYSCALL(__NR_process_vm_writev),
        LV_DENY_SYSCALL(__NR_mount),
        LV_DENY_SYSCALL(__NR_umount2),
        LV_DENY_SYSCALL(__NR_unshare),
        LV_DENY_SYSCALL(__NR_setns),
        LV_DENY_SYSCALL(__NR_chroot),
        LV_DENY_SYSCALL(__NR_pivot_root),
        LV_DENY_SYSCALL(__NR_bpf),
#ifdef __NR_memfd_create
        LV_DENY_SYSCALL(__NR_memfd_create),
#endif
#ifdef __NR_open_by_handle_at
        LV_DENY_SYSCALL(__NR_open_by_handle_at),
#endif
#ifdef __NR_name_to_handle_at
        LV_DENY_SYSCALL(__NR_name_to_handle_at),
#endif
        LV_DENY_SYSCALL(__NR_perf_event_open),
        LV_DENY_SYSCALL(__NR_kcmp),
#ifdef __NR_userfaultfd
        LV_DENY_SYSCALL(__NR_userfaultfd),
#endif
        LV_DENY_SYSCALL(__NR_kill),
        LV_DENY_SYSCALL(__NR_init_module),
        LV_DENY_SYSCALL(__NR_finit_module),
        LV_DENY_SYSCALL(__NR_delete_module),
        LV_DENY_SYSCALL(__NR_reboot),
        LV_DENY_SYSCALL(__NR_acct),
        LV_DENY_SYSCALL(__NR_quotactl),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    };

    struct sock_fprog prog = {
        .len = (unsigned short)(sizeof(filter) / sizeof(filter[0])),
        .filter = filter,
    };
    prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog);
}

__attribute__((section(".preinit_array"), used))
void (* const lv_preinit_hook)(void) = lv_sandbox_preinit;
