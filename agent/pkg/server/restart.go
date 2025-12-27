package server

import (
	"log"
	"os"
	"os/exec"
	"syscall"
)

func TriggerRestart() error {
	argv0, err := exec.LookPath(os.Args[0])
	if err != nil {
		return err
	}

	log.Println("Restarting agent...")

	// Use syscall.Exec to replace the current process
	if err := syscall.Exec(argv0, os.Args, os.Environ()); err != nil {
		return err
	}
	return nil
}
